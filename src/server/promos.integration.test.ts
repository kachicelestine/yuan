import { beforeAll, describe, expect, it } from "vitest";
import { DrizzleInvoiceRepository } from "@/modules/payments/infrastructure/drizzle-payments-repositories";
import { SimulatedNetwork } from "@/modules/payments/infrastructure/networks";
import { openDatabase, type Database } from "@/shared/infrastructure/database";
import { OutboxDispatcher } from "@/shared/infrastructure/outbox";
import { money, newId } from "@/shared/kernel";
import { wire } from "./container";
import { eventHandlers } from "./jobs/jobs";
import { seedAll } from "./seed";

// Drops (a price and stock for a while, reminders before) and team buys (a price that
// unlocks when the team is full), with the real wiring on in-memory Postgres.
describe("drops and team buys", () => {
  let db: Database;
  let network: SimulatedNetwork;
  let now = new Date("2026-10-24T10:00:00Z");
  const app = () => wire(db, { clock: { now: () => now }, payments: { network, simulator: network } });
  const drain = async () => {
    const d = new OutboxDispatcher(db, eventHandlers(app()), { now: () => now, maxAttempts: 1 });
    for (let i = 0; i < 10; i++) if ((await d.dispatchOnce()).claimed === 0) break;
  };
  const pay = async (buyerId: string, slug: string) => {
    const r = await app().checkout({ buyerId, lines: [{ slug, option: null, qty: 1 }], country: "NG", shippingMethod: "standard", combineParcels: true, payDutiesNow: true, couponId: null, rail: "usdc-base" });
    if (!r.ok) throw new Error(r.error.message);
    await network.send((await new DrizzleInvoiceRepository(db).findById(r.value.invoiceId))!, now);
    await app().checkInvoice(r.value.invoiceId);
    return r.value;
  };

  beforeAll(async () => {
    db = await openDatabase({ kind: "memory" });
    await seedAll(db, now);
    network = new SimulatedNetwork(db);
  });

  it("schedules a drop, reminds people before it opens, and sells the drop price within its limits", async () => {
    const own = (await app().catalog.listProducts({ seller: "mei", limit: 1 }))[0];
    expect((await app().promos.scheduleDrop("mei", { slug: own.slug, kind: "drop", title: "Too soon", blurb: "", startsAt: new Date(now.getTime() + 60_000), price: money.fromDollars(own.price! * 0.5), stock: 2, perPerson: 1 })).ok).toBe(false);
    const made = await app().promos.scheduleDrop("mei", { slug: own.slug, kind: "drop", title: "Silk drop", blurb: "Two only", startsAt: new Date(now.getTime() + 3_600_000), price: money.fromDollars(own.price! * 0.5), stock: 2, perPerson: 1 });
    if (!made.ok) throw new Error(made.error.message);
    const id = made.value.id;

    const fan = newId();
    expect((await app().promos.remind(fan, id, true)).ok).toBe(true);
    expect((await app().promos.drops(fan)).find((d) => d.id === id)).toMatchObject({ state: "upcoming", waiting: 1, reminded: true });
    expect((await app().promos.claim(fan, id)).ok).toBe(false); // not open yet
    // 10 minutes before: the reminder goes out once.
    now = new Date(now.getTime() + 51 * 60_000);
    expect((await app().promos.dueReminders()).map((r) => r.accountId)).toEqual([fan]);
    expect(await app().promos.dueReminders()).toEqual([]);

    now = new Date(now.getTime() + 10 * 60_000);
    const claimed = await app().promos.claim(fan, id);
    expect(claimed.ok && claimed.value.price).toBe(Math.round(own.price! * 50) / 100);
    const twice = await app().promos.claim(fan, id);
    expect(!twice.ok && twice.error.code).toBe("limit_reached");
    expect((await app().promos.claim(newId(), id)).ok).toBe(true);
    const third = await app().promos.claim(newId(), id);
    expect(!third.ok && third.error.code).toBe("sold_out");

    // Checkout honours the held drop price; payment uses it up.
    const order = await pay(fan, own.slug);
    expect(order.pricing.subtotal).toBe(money.fromDollars(own.price! * 0.5));
    await drain();
    expect(await app().promos.bestHold(fan, own.slug)).toBeNull();
  });

  it("gives back drop stock nobody checked out", async () => {
    const own = (await app().catalog.listProducts({ seller: "sunvolt", limit: 1 }))[0];
    const made = await app().promos.scheduleDrop("sunvolt", { slug: own.slug, kind: "drop", title: "Panel drop", blurb: "", startsAt: new Date(now.getTime() + 20 * 60_000), price: money.fromDollars(own.price! * 0.8), stock: 1, perPerson: 1 });
    if (!made.ok) throw new Error(made.error.message);
    now = new Date(now.getTime() + 21 * 60_000);
    expect((await app().promos.claim(newId(), made.value.id)).ok).toBe(true);
    expect((await app().promos.drops(null)).find((d) => d.id === made.value.id)?.state).toBe("sold_out");
    now = new Date(now.getTime() + 31 * 60_000);
    // (The earlier test's unpaid claim lapses too.)
    expect((await app().promos.sweep()).returned).toBeGreaterThanOrEqual(1);
    expect((await app().promos.drops(null)).find((d) => d.id === made.value.id)?.state).toBe("live");
  });

  it("unlocks the team price for every member once the team is full", async () => {
    const [{ offer }] = await app().promos.teamOffers();
    const members = Array.from({ length: offer.size }, (_, i) => ({ accountId: newId(), name: `shopper-${i}` }));
    const started = await app().promos.startTeam(members[0], offer.id);
    if (!started.ok) throw new Error(started.error.message);
    expect(await app().promos.startTeam(members[0], offer.id)).toEqual(started);
    const twice = await app().promos.joinTeam(started.value.id, members[0]);
    expect(!twice.ok && twice.error.code).toBe("already_in");
    let last;
    for (const m of members.slice(1)) last = await app().promos.joinTeam(started.value.id, m);
    expect(last?.ok && last.value).toMatchObject({ status: "full", youAreIn: true });
    expect((await app().promos.joinTeam(started.value.id, { accountId: newId(), name: "late" })).ok).toBe(false);
    await drain();
    for (const m of members) {
      expect(await app().promos.bestHold(m.accountId, offer.slug)).toEqual({ price: money.fromDollars(offer.teamPrice), qty: 1 });
      expect((await app().notifications.list(m.accountId)).some((n) => n.kind === "team_full")).toBe(true);
    }
  });

  it("closes teams that don't fill in time and frees their slot", async () => {
    const [{ offer }] = await app().promos.teamOffers();
    const t = await app().promos.startTeam({ accountId: newId(), name: "solo" }, offer.id);
    if (!t.ok) throw new Error(t.error.message);
    const before = (await app().promos.teamOffers()).find((x) => x.offer.id === offer.id)!.offer.remaining;
    now = new Date(now.getTime() + (offer.hours + 1) * 3_600_000);
    expect((await app().promos.sweep()).closed).toBeGreaterThanOrEqual(1);
    expect((await app().promos.team(t.value.id, null))?.status).toBe("expired");
    expect((await app().promos.teamOffers()).find((x) => x.offer.id === offer.id)!.offer.remaining).toBe(before + 1);
  });
});
