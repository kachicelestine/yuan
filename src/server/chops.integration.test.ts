import { TEST_ADDRESS } from "./test-address";
import { beforeAll, describe, expect, it } from "vitest";
import { DrizzleInvoiceRepository } from "@/modules/payments/infrastructure/drizzle-payments-repositories";
import { SimulatedNetwork } from "@/modules/payments/infrastructure/networks";
import { openDatabase, type Database } from "@/shared/infrastructure/database";
import { OutboxDispatcher } from "@/shared/infrastructure/outbox";
import { money, newId } from "@/shared/kernel";
import { wire } from "./container";
import { eventHandlers } from "./jobs/jobs";
import { seedAll } from "./seed";

// Start a chop, friends cut it to the target, the owner checks out at that price once;
// chops that run out of time give their stock back.
describe("price chops", () => {
  let db: Database;
  let network: SimulatedNetwork;
  let now = new Date("2026-10-24T10:00:00Z");
  const app = () => wire(db, { clock: { now: () => now }, payments: { network, simulator: network } });
  const drain = async () => {
    const d = new OutboxDispatcher(db, eventHandlers(app()), { now: () => now, maxAttempts: 1 });
    for (let i = 0; i < 10; i++) if ((await d.dispatchOnce()).claimed === 0) break;
  };
  const owner = { accountId: newId(), name: "shopper-0wner1" };

  beforeAll(async () => {
    db = await openDatabase({ kind: "memory" });
    await seedAll(db);
    network = new SimulatedNetwork(db);
  });

  it("chops to the target with friends, then sells one at that price", async () => {
    const offer = (await app().chops.offers()).find((o) => o.slug === "earbuds-anc")!;
    expect(offer).toBeDefined();
    const started = await app().chops.start(owner, offer.id);
    if (!started.ok) throw new Error(started.error.message);
    const id = started.value.id;
    // Starting again opens the same chop.
    expect(await app().chops.start(owner, offer.id)).toEqual(started);
    expect((await app().chops.offers()).find((o) => o.id === offer.id)!.remaining).toBe(offer.remaining - 1);

    const first = await app().chops.view(id, { cutter: owner.accountId, accountId: owner.accountId });
    expect(first).toMatchObject({ yours: true, done: 1, status: "open", cuts: offer.cuts, fullPrice: offer.fullPrice, target: offer.target });
    expect(first!.price).toBeLessThan(offer.fullPrice);

    expect((await app().chops.cut(id, { id: owner.accountId, accountId: owner.accountId, name: "x" })).ok).toBe(false);
    const friend = newId();
    expect((await app().chops.cut(id, { id: friend, accountId: null, name: "A friend" })).ok).toBe(true);
    const again = await app().chops.cut(id, { id: friend, accountId: null, name: "A friend" });
    expect(!again.ok && again.error.code).toBe("already_cut");

    let last;
    for (let i = 2; i < offer.cuts; i++) last = await app().chops.cut(id, { id: newId(), accountId: null, name: `Friend ${i}` });
    expect(last?.ok && last.value).toMatchObject({ status: "done", done: offer.cuts, price: offer.target });
    // Nobody can cut past the target.
    expect((await app().chops.cut(id, { id: newId(), accountId: null, name: "Late" })).ok).toBe(false);

    await drain();
    expect((await app().notifications.list(owner.accountId)).some((n) => n.kind === "chop_done")).toBe(true);

    // Checkout honours the chopped price for one item.
    expect(await app().chops.bestHold(owner.accountId, "earbuds-anc")).toEqual({ price: money.fromDollars(offer.target), qty: 1 });
    const r = await app().checkout({ buyerId: owner.accountId, lines: [{ slug: "earbuds-anc", option: null, qty: 1 }], country: "NG", shippingMethod: "standard", combineParcels: true, payDutiesNow: true, couponId: null, rail: "usdc-base", address: TEST_ADDRESS });
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value.pricing.subtotal).toBe(money.fromDollars(offer.target));
    const invoice = await new DrizzleInvoiceRepository(db).findById(r.value.invoiceId);
    await network.send(invoice!, now);
    await app().checkInvoice(r.value.invoiceId);
    await drain();
    // Used up: the next one costs the normal price.
    expect(await app().chops.bestHold(owner.accountId, "earbuds-anc")).toBeNull();
    expect((await app().chops.view(id, { cutter: null, accountId: null }))?.status).toBe("used");
  });

  it("gives the stock back when time runs out, and limits cuts per person per day", async () => {
    const offer = (await app().chops.offers()).find((o) => o.slug === "lamp-brass-pendant")!;
    const someone = { accountId: newId(), name: "shopper-late01" };
    const started = await app().chops.start(someone, offer.id);
    if (!started.ok) throw new Error(started.error.message);
    const busy = newId();
    // One person's cuts across many chops are capped per day.
    for (let i = 0; i < 10; i++) {
      const other = { accountId: newId(), name: `shopper-${i}` };
      const s = await app().chops.start(other, offer.id);
      if (s.ok) await app().chops.cut(s.value.id, { id: busy, accountId: null, name: "Busy" });
    }
    const capped = await app().chops.cut(started.value.id, { id: busy, accountId: null, name: "Busy" });
    expect(!capped.ok && capped.error.code).toBe("too_many_cuts");

    const before = (await app().chops.offers()).find((o) => o.id === offer.id)!.remaining;
    now = new Date(now.getTime() + 25 * 3_600_000);
    expect(await app().chops.expire()).toBeGreaterThanOrEqual(1);
    expect((await app().chops.offers()).find((o) => o.id === offer.id)!.remaining).toBeGreaterThan(before);
    expect((await app().chops.view(started.value.id, { cutter: null, accountId: null }))?.status).toBe("expired");
  });

  it("lets a shop offer only its own priced listings, at least 10% off", async () => {
    expect((await app().chops.createOffer("mei", { slug: "earbuds-anc", target: money.fromDollars(5), cuts: 5, hours: 24, stock: 10 })).ok).toBe(false);
    const own = (await app().catalog.listProducts({ seller: "mei", limit: 1 }))[0];
    expect((await app().chops.createOffer("mei", { slug: own.slug, target: money.fromDollars(own.price! * 0.95), cuts: 5, hours: 24, stock: 10 })).ok).toBe(false);
    const ok = await app().chops.createOffer("mei", { slug: own.slug, target: money.fromDollars(own.price! * 0.5), cuts: 5, hours: 24, stock: 10 });
    expect(ok.ok).toBe(true);
    expect((await app().chops.sellerOffers("mei")).some((o) => o.slug === own.slug && o.started === 0)).toBe(true);
  });
});
