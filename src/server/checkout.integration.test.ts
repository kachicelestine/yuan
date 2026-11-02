import { TEST_ADDRESS } from "./test-address";
import { beforeAll, describe, expect, it } from "vitest";
import type { CheckoutRequest } from "@/modules/ordering";
import { DrizzleInvoiceRepository } from "@/modules/payments/infrastructure/drizzle-payments-repositories";
import { outbox } from "@/shared/infrastructure/platform-schema";
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
    delivery: "cheapest",
    combineParcels: true,
    payDutiesNow: true,
    couponId: "welcome5",
    rail: "usdc-base", address: TEST_ADDRESS,
    ...patch,
  });
  /** Topics recorded in the outbox for an aggregate, oldest first. */
  const eventsFor = async (key: string) => (await db.select({ topic: outbox.topic, key: outbox.key }).from(outbox)).filter((r) => r.key === key).map((r) => r.topic);
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

  it("charges the delivery company the buyer picked, and records it on the order", async () => {
    const buyer = await newBuyer([]);
    const lines = [{ slug: "earbuds-anc", option: null, qty: 1 }];
    const cheapest = await app().checkout(request(buyer, { lines, couponId: null }));
    const dhl = await app().checkout(request(buyer, { lines, couponId: null, delivery: "dhl-express-worldwide" }));
    if (!cheapest.ok || !dhl.ok) throw new Error("checkout failed");
    // Under the free-shipping threshold each company costs its own price; DHL is dearer.
    expect(dhl.value.pricing.shipping).toBeGreaterThan(cheapest.value.pricing.shipping);
    const order = await app().getOrder.byNumber(dhl.value.orderNumber, buyer);
    expect(order?.delivery).toMatchObject({ id: "dhl-express-worldwide", company: "DHL Express", deliveredBy: "DHL Express", price: dhl.value.pricing.shipping / 100 });
    expect(order?.shippingMethod).toBe("express");

    // Over it, the cheapest company is free and DHL costs only the difference.
    const big = [{ slug: "hoodie-heavyweight", option: null, qty: 3 }];
    const free = await app().checkout(request(buyer, { lines: big, couponId: null }));
    const upgrade = await app().checkout(request(buyer, { lines: big, couponId: null, delivery: "dhl-express-worldwide" }));
    if (!free.ok || !upgrade.ok) throw new Error("checkout failed");
    expect(free.value.pricing.shipping).toBe(0);
    const freeOrder = await app().getOrder.byNumber(free.value.orderNumber, buyer);
    const upgradeOrder = await app().getOrder.byNumber(upgrade.value.orderNumber, buyer);
    expect(upgrade.value.pricing.shipping / 100).toBeCloseTo(upgradeOrder!.delivery!.price - freeOrder!.delivery!.price);
  });

  it("refuses a delivery company that can't take the order", async () => {
    const buyer = await newBuyer([]);
    // YunExpress doesn't deliver in Nigeria, and nothing is called "made-up".
    for (const delivery of ["yunexpress-direct", "made-up"]) {
      expect(await app().checkout(request(buyer, { couponId: null, delivery }))).toMatchObject({ ok: false, error: { code: "delivery_unavailable" } });
    }
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

  it("records what happened in the outbox, in the same transactions", async () => {
    const buyer = await newBuyer();
    const r = await app().checkout(request(buyer));
    if (!r.ok) throw new Error(r.error.message);
    expect(await eventsFor(r.value.orderId)).toEqual(["OrderPlaced"]);
    await pay(r.value.invoiceId);
    expect(await eventsFor(r.value.orderId)).toEqual(["OrderPlaced", "OrderPaid"]);
    expect(await eventsFor(r.value.invoiceId)).toEqual(["InvoicePaid"]);

    // A failed checkout leaves no trace.
    const before = await db.$count(outbox);
    await app().checkout(request(buyer, { rail: "dogecoin" }));
    expect(await db.$count(outbox)).toBe(before);
  });

  it("needs a delivery address, which the shop sees only once the order is paid", async () => {
    const buyer = await newBuyer([]);
    const noStreet = await app().checkout(request(buyer, { couponId: null, address: { ...TEST_ADDRESS, line1: " " } }));
    expect(!noStreet.ok && noStreet.error.code).toBe("invalid_address");
    const r = await app().checkout(request(buyer, { couponId: null, lines: [{ slug: "earbuds-anc", option: null, qty: 1 }], address: { ...TEST_ADDRESS, line2: "Flat 3" } }));
    if (!r.ok) throw new Error(r.error.message);
    expect((await app().getOrder.byNumber(r.value.orderNumber, buyer))?.address).toMatchObject({ name: "Ada Obi", line1: "12 Admiralty Way", line2: "Flat 3", city: "Lagos" });
    const sellerId = (await app().catalog.getProductsBySlugs(["earbuds-anc"]))[0].sellerId;
    const unpaid = (await app().sellerOrders.list(sellerId)).find((o) => o.id === r.value.orderId);
    expect(unpaid?.address).toBeNull();
    await pay(r.value.invoiceId);
    const paid = (await app().sellerOrders.list(sellerId)).find((o) => o.id === r.value.orderId);
    expect(paid?.address).toMatchObject({ name: "Ada Obi", phone: "+234 803 123 4567" });
  });

  it("sweeps open invoices in the background: lapsed ones close without anyone visiting", async () => {
    const buyer = await newBuyer([]);
    const r = await app().checkout(request(buyer, { couponId: null }));
    if (!r.ok) throw new Error(r.error.message);
    clock = fixedClock("2026-10-24T11:00:00Z");
    try {
      const swept = await app().syncInvoices();
      expect(swept.checked).toBeGreaterThan(0);
      expect(swept.expired).toBeGreaterThan(0);
      expect((await app().getOrder.byNumber(r.value.orderNumber, buyer))?.status).toBe("cancelled");
      expect(await eventsFor(r.value.orderId)).toEqual(["OrderPlaced", "OrderCancelled"]);
      expect(await eventsFor(r.value.invoiceId)).toEqual(["InvoiceExpired"]);
    } finally {
      clock = fixedClock("2026-10-24T10:00:00Z");
    }
  });
});
