import { beforeAll, describe, expect, it } from "vitest";
import type { CheckoutRequest } from "@/modules/ordering";
import { DrizzleInvoiceRepository } from "@/modules/payments/infrastructure/drizzle-payments-repositories";
import { SimulatedNetwork } from "@/modules/payments/infrastructure/networks";
import { openDatabase, type Database } from "@/shared/infrastructure/database";
import { fixedClock, newId } from "@/shared/kernel";
import { wire } from "./container";
import { seedAll } from "./seed";

// The real wiring from container.ts, on in-memory Postgres with a fixed clock.
describe("checkout and payment, end to end", () => {
  let db: Database;
  let clock = fixedClock("2026-10-24T10:00:00Z");
  let tag = 0;
  let network: SimulatedNetwork;
  const app = () => wire(db, { clock: { now: () => clock.now() }, newTag: () => ++tag, payments: { network, simulator: network } });

  // Each test buys as a fresh buyer, so coupons spent in one test don't leak into another.
  const newBuyer = async (coupons: string[] = ["welcome5"]) => {
    const buyer = newId();
    await app().engagement.claimCoupons(buyer, coupons);
    return buyer;
  };
  const request = (buyerId: string, patch: Partial<CheckoutRequest> = {}): CheckoutRequest => ({
    buyerId,
    lines: [
      { slug: "hoodie-heavyweight", option: null, qty: 2 },
      { slug: "earbuds-anc", option: null, qty: 1 },
    ],
    country: "NG",
    shippingMethod: "standard",
    combineParcels: true,
    payDutiesNow: true,
    couponId: "welcome5",
    rail: "usdc-base",
    ...patch,
  });
  const pay = async (invoiceId: string) => {
    const invoice = await new DrizzleInvoiceRepository(db).findById(invoiceId);
    await network.send(invoice!, clock.now());
    return app().checkInvoice(invoiceId);
  };

  beforeAll(async () => {
    db = await openDatabase({ kind: "memory" });
    await seedAll(db);
    network = new SimulatedNetwork(db);
  });

  it("places an order priced by the server and opens its invoice", async () => {
    const buyer = await newBuyer();
    const r = await app().checkout(request(buyer));
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.orderNumber).toMatch(/^LY-/);
    expect(r.value.pricing.discount).toBe(500);
    const order = await app().getOrder.byNumber(r.value.orderNumber, buyer);
    expect(order?.status).toBe("awaiting_payment");
    expect(order?.lines.map((l) => l.slug)).toEqual(["hoodie-heavyweight", "earbuds-anc"]);
    expect(order?.totals.total).toBe(r.value.pricing.total / 100);
  });

  it("settles a paid invoice: invoice paid, order paid, funds in escrow", async () => {
    const buyer = await newBuyer();
    const r = await app().checkout(request(buyer));
    if (!r.ok) throw new Error(r.error.message);

    const before = await app().checkInvoice(r.value.invoiceId);
    expect(before?.status).toBe("pending");
    expect(before?.exactAmount).toMatch(/^\d+\.\d{6}$/);

    expect((await pay(r.value.invoiceId))?.status).toBe("paid");
    expect((await app().getOrder.byNumber(r.value.orderNumber, buyer))?.status).toBe("paid");
    expect(await app().ledger.balance(`escrow:${r.value.orderId}`)).toBe(-r.value.pricing.total);

    // Checking again is harmless: no second journal, no error.
    expect((await app().checkInvoice(r.value.invoiceId))?.status).toBe("paid");
  });

  it("shows an order only to the buyer who placed it", async () => {
    const buyer = await newBuyer();
    const r = await app().checkout(request(buyer));
    if (!r.ok) throw new Error(r.error.message);
    expect(await app().getOrder.byNumber(r.value.orderNumber, buyer)).not.toBeNull();
    expect(await app().getOrder.byNumber(r.value.orderNumber, newId())).toBeNull();
    expect((await app().getOrder.list(buyer)).some((o) => o.number === r.value.orderNumber)).toBe(true);
  });

  it("rejects what the browser can't be trusted with", async () => {
    const buyer = await newBuyer();
    const fail = async (patch: Partial<CheckoutRequest>) => {
      const r = await app().checkout(request(buyer, patch));
      return r.ok ? null : r.error.code;
    };
    expect(await fail({ lines: [] })).toBe("empty_order");
    expect(await fail({ lines: [{ slug: "nope", option: null, qty: 1 }] })).toBe("unknown_product");
    expect(await fail({ lines: [{ slug: "ev-sedan-export", option: null, qty: 1 }] })).toBe("quote_only");
    expect(await fail({ lines: [{ slug: "hoodie-heavyweight", option: "XXXL · Gold", qty: 1 }] })).toBe("unknown_option");
    expect(await fail({ country: "ZZ" })).toBe("unknown_country");
    expect(await fail({ rail: "dogecoin" })).toBe("rail_unavailable");
    // A coupon that was never claimed into this wallet.
    expect(await fail({ couponId: "glow3" })).toBe("coupon_unavailable");
  });

  it("rolls the order and its coupon back when the invoice can't be opened", async () => {
    const buyer = await newBuyer();
    const { orders } = await import("@/modules/ordering/infrastructure/schema");
    const before = await db.$count(orders);
    await app().checkout(request(buyer, { rail: "dogecoin" }));
    expect(await db.$count(orders)).toBe(before);
    expect(await app().engagement.wallet(buyer)).toContain("welcome5");
  });

  it("spends a coupon once: reserved at checkout, used on payment", async () => {
    const buyer = await newBuyer();
    const first = await app().checkout(request(buyer));
    if (!first.ok) throw new Error(first.error.message);
    expect(await app().engagement.wallet(buyer)).not.toContain("welcome5");

    // While the first order holds it, a second checkout can't take it.
    const second = await app().checkout(request(buyer));
    expect(second.ok ? null : second.error.code).toBe("coupon_unavailable");

    await pay(first.value.invoiceId);
    expect(await app().engagement.wallet(buyer)).not.toContain("welcome5");
    const third = await app().checkout(request(buyer));
    expect(third.ok ? null : third.error.code).toBe("coupon_unavailable");
  });

  it("expires invoices nobody paid, cancels the order and gives the coupon back", async () => {
    const buyer = await newBuyer();
    const r = await app().checkout(request(buyer));
    if (!r.ok) throw new Error(r.error.message);
    clock = fixedClock("2026-10-24T11:00:00Z");
    try {
      expect((await app().checkInvoice(r.value.invoiceId))?.status).toBe("expired");
      expect((await app().getOrder.byNumber(r.value.orderNumber, buyer))?.status).toBe("cancelled");
      expect(await app().engagement.wallet(buyer)).toContain("welcome5");
    } finally {
      clock = fixedClock("2026-10-24T10:00:00Z");
    }
  });

  it("still settles a payment that lands after the window closed", async () => {
    const buyer = await newBuyer([]);
    const r = await app().checkout(request(buyer, { couponId: null }));
    if (!r.ok) throw new Error(r.error.message);
    clock = fixedClock("2026-10-24T11:00:00Z");
    try {
      await app().checkInvoice(r.value.invoiceId);
      const late = await pay(r.value.invoiceId);
      expect(late?.status).toBe("paid");
      expect(late?.late).toBe(true);
      expect((await app().getOrder.byNumber(r.value.orderNumber, buyer))?.status).toBe("paid");
    } finally {
      clock = fixedClock("2026-10-24T10:00:00Z");
    }
  });
});
