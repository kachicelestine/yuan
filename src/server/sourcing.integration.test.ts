import { beforeAll, describe, expect, it } from "vitest";
import type { CheckoutRequest } from "@/modules/ordering";
import { DrizzleInvoiceRepository } from "@/modules/payments/infrastructure/drizzle-payments-repositories";
import { SimulatedNetwork } from "@/modules/payments/infrastructure/networks";
import { OutboxDispatcher } from "@/shared/infrastructure/outbox";
import { openDatabase, type Database } from "@/shared/infrastructure/database";
import { money, newId } from "@/shared/kernel";
import { wire } from "./container";
import { eventHandlers } from "./jobs/jobs";
import { seedAll } from "./seed";

// Wholesale: a request goes to shops that make the thing; each may quote one of its
// listings; accepting holds that price for the quantities quoted, in the bag and at
// checkout (even for a listing sold only by quote), until an order pays for it.
describe("requests for quotes", () => {
  let db: Database;
  let network: SimulatedNetwork;
  let now = new Date("2026-10-24T10:00:00Z");
  const app = () => wire(db, { clock: { now: () => now }, payments: { network, simulator: network } });
  const buyer = { accountId: newId(), name: "shopper-buy001" };
  const ask = (patch: Partial<Parameters<ReturnType<typeof app>["sourcing"]["open"]>[1]> = {}) =>
    app().sourcing.open(buyer, { item: "450 W solar panels", details: "All-black frames", slug: null, qty: 200, target: money.fromDollars(80), port: "Tema, Ghana", incoterm: "CIF", samples: true, ...patch });
  const order = (slug: string, qty: number): CheckoutRequest => ({ buyerId: buyer.accountId, lines: [{ slug, option: null, qty }], country: "NG", shippingMethod: "standard", combineParcels: true, payDutiesNow: true, couponId: null, rail: "usdc-base" });
  const unitPrice = async (slug: string, qty: number) => {
    const r = await app().checkout(order(slug, qty));
    return r.ok ? r.value.pricing.subtotal / qty / 100 : r.error.code;
  };
  const drain = async () => {
    const d = new OutboxDispatcher(db, eventHandlers(app()), { now: () => now, maxAttempts: 1 });
    for (let i = 0; i < 10; i++) if ((await d.dispatchOnce()).claimed === 0) break;
  };

  beforeAll(async () => {
    db = await openDatabase({ kind: "memory" });
    await seedAll(db, now);
    network = new SimulatedNetwork(db);
  });

  it("sends a request to the shops that make it, and takes quotes only from them, for their own listings", async () => {
    const opened = await ask();
    if (!opened.ok) throw new Error(opened.error.message);
    const rfq = opened.value;
    expect(rfq).toMatchObject({ code: `RFQ-${rfq.id.toUpperCase()}`, status: "open", qty: 200, target: 80, quotes: [] });
    const inbox = await app().sourcing.inbox("sunvolt");
    expect(inbox.map((r) => r.id)).toContain(rfq.id);
    expect(inbox.find((r) => r.id === rfq.id)).toMatchObject({ buyerName: "shopper-buy001", mine: null, quotes: 0 });
    // A shop it wasn't sent to can't see or quote it.
    expect(await app().sourcing.forShop("glowlab", rfq.id)).toBeNull();
    expect((await app().sourcing.quote("glowlab", rfq.id, { slug: "serum-niacinamide", unitPrice: money.fromDollars(1), moq: 1, leadDays: 5, sample: null, note: "" })).ok).toBe(false);
    // Nor quote someone else's listing.
    const notMine = await app().sourcing.quote("sunvolt", rfq.id, { slug: "ev-sedan-export", unitPrice: money.fromDollars(10), moq: 1, leadDays: 5, sample: null, note: "" });
    expect(!notMine.ok && notMine.error.code).toBe("invalid_quote");

    expect((await ask({ item: "zz qq xx" })).ok).toBe(false); // nobody makes that
  });

  it("holds an accepted quote's price for the quoted quantities, in the bag and at checkout, until paid", async () => {
    const rfq = (await app().sourcing.mine(buyer.accountId)).find((r) => r.item === "450 W solar panels")!;
    const slug = "solar-panel-450w-bifacial";
    // The catalog's own price at each quantity (bulk tiers included).
    const [at50, at150, at201] = [(await unitPrice(slug, 50)) as number, (await unitPrice(slug, 150)) as number, (await unitPrice(slug, 201)) as number];
    const quotedPrice = at150 - 5;
    const quoted = await app().sourcing.quote("sunvolt", rfq.id, { slug, unitPrice: money.fromDollars(quotedPrice + 2), moq: 100, leadDays: 18, sample: money.fromDollars(25), note: "Black frames, 30-year warranty" });
    if (!quoted.ok) throw new Error(quoted.error.message);
    // Revising keeps one quote per shop.
    await app().sourcing.quote("sunvolt", rfq.id, { slug, unitPrice: money.fromDollars(quotedPrice), moq: 100, leadDays: 18, sample: money.fromDollars(25), note: "Revised" });
    const view = (await app().sourcing.mine(buyer.accountId)).find((r) => r.id === rfq.id)!;
    expect(view.quotes).toHaveLength(1);
    expect(view.quotes[0]).toMatchObject({ unitPrice: quotedPrice, moq: 100, sample: 25, note: "Revised", status: "offered" });
    expect((await app().sourcing.forShop("sunvolt", rfq.id))?.mine?.note).toBe("Revised");

    await drain();
    expect((await app().notifications.list(buyer.accountId)).map((n) => n.title)).toContain("You have a new quote");

    const quoteId = view.quotes[0].id;
    const accepted = await app().sourcing.accept(buyer.accountId, quoteId);
    if (!accepted.ok) throw new Error(accepted.error.message);
    expect(accepted.value).toMatchObject({ slug, price: quotedPrice, min: 100, max: 200 });
    expect(accepted.value.rfq.status).toBe("ordered");
    expect((await app().sourcing.accept(buyer.accountId, quoteId)).ok).toBe(false); // once

    expect(await unitPrice(slug, 150)).toBe(quotedPrice);
    expect(await unitPrice(slug, 50)).toBe(at50); // under the quote's minimum
    expect(await unitPrice(slug, 201)).toBe(at201); // over what was asked
    // The bag shows the held price too.
    const bag = await app().cart.replace(buyer.accountId, [{ slug, option: null, qty: 150, note: null }]);
    expect(bag[0].unitPrice).toBe(quotedPrice);

    const r = await app().checkout(order(slug, 150));
    if (!r.ok) throw new Error(r.error.message);
    await network.send((await new DrizzleInvoiceRepository(db).findById(r.value.invoiceId))!, now);
    await app().checkInvoice(r.value.invoiceId);
    await drain();
    expect(await unitPrice(slug, 150)).toBe(at150); // used up
  });

  it("makes a listing sold only by quote buyable at the quoted price", async () => {
    expect(await unitPrice("ev-sedan-export", 2)).toBe("quote_only");
    const asked = await ask({ item: "Electric sedan, export spec", slug: "ev-sedan-export", qty: 2, target: null, incoterm: "DDP", port: "Apapa, Lagos" });
    if (!asked.ok) throw new Error(asked.error.message);
    expect(await app().sourcing.forShop("evdesk", asked.value.id)).not.toBeNull();
    expect(asked.value.shops).toBe(1);
    const q = await app().sourcing.quote("evdesk", asked.value.id, { slug: "ev-sedan-export", unitPrice: money.fromDollars(14_500), moq: 1, leadDays: 45, sample: null, note: "Right-hand drive available" });
    if (!q.ok) throw new Error(q.error.message);
    const quoteId = (await app().sourcing.mine(buyer.accountId)).find((r) => r.id === asked.value.id)!.quotes[0].id;
    expect((await app().sourcing.accept(newId(), quoteId)).ok).toBe(false); // not their request
    expect((await app().sourcing.accept(buyer.accountId, quoteId)).ok).toBe(true);
    expect(await unitPrice("ev-sedan-export", 2)).toBe(14_500);
    expect(await unitPrice("ev-sedan-export", 3)).toBe("quote_only");
    await drain();
  });

  it("lets a shop withdraw, and closes requests after two weeks", async () => {
    const opened = await ask({ item: "solar panel mounting", qty: 40 });
    if (!opened.ok) throw new Error(opened.error.message);
    const id = opened.value.id;
    await app().sourcing.quote("sunvolt", id, { slug: "solar-panel-450w-bifacial", unitPrice: money.fromDollars(50), moq: 10, leadDays: 10, sample: null, note: "" });
    expect((await app().sourcing.withdraw("sunvolt", id)).ok).toBe(true);
    expect((await app().sourcing.mine(buyer.accountId)).find((r) => r.id === id)!.quotes).toEqual([]);

    now = new Date(now.getTime() + 15 * 86_400_000);
    expect((await app().sourcing.mine(buyer.accountId)).find((r) => r.id === id)!.status).toBe("closed");
    expect(await app().sourcing.expire()).toBeGreaterThanOrEqual(1);
    const late = await app().sourcing.quote("sunvolt", id, { slug: "solar-panel-450w-bifacial", unitPrice: money.fromDollars(50), moq: 10, leadDays: 10, sample: null, note: "" });
    expect(!late.ok && late.error.code).toBe("closed");
  });
});
