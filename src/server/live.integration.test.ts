import { TEST_ADDRESS } from "./test-address";
import { beforeAll, describe, expect, it } from "vitest";
import type { LiveBus, LiveSignal } from "@/modules/live";
import { DrizzleInvoiceRepository } from "@/modules/payments/infrastructure/drizzle-payments-repositories";
import { SimulatedNetwork } from "@/modules/payments/infrastructure/networks";
import { openDatabase, type Database } from "@/shared/infrastructure/database";
import { OutboxDispatcher } from "@/shared/infrastructure/outbox";
import { money, newId } from "@/shared/kernel";
import { wire } from "./container";
import { eventHandlers } from "./jobs/jobs";
import { seedAll } from "./seed";

/** Records what's published and delivers it to subscribers, like the Postgres bus. */
class RecordingBus implements LiveBus {
  readonly sent: { showId: string; signal: LiveSignal }[] = [];
  private readonly listeners = new Map<string, Set<(s: LiveSignal) => void>>();
  async publish(showId: string, signal: LiveSignal) {
    this.sent.push({ showId, signal });
    for (const l of this.listeners.get(showId) ?? []) l(signal);
  }
  subscribe(showId: string, l: (s: LiveSignal) => void) {
    const set = this.listeners.get(showId) ?? new Set();
    set.add(l);
    this.listeners.set(showId, set);
    return () => void set.delete(l);
  }
}

describe("live shopping", () => {
  let db: Database;
  let network: SimulatedNetwork;
  let now = new Date("2026-10-24T13:00:00Z");
  let tag = 0;
  const bus = new RecordingBus();
  const clock = { now: () => now };
  const app = () => wire(db, { clock, newTag: () => ++tag, payments: { network, simulator: network }, bus });
  const host = { accountId: newId(), name: "Ava", sellerId: "glowlab" };

  beforeAll(async () => {
    db = await openDatabase({ kind: "memory" });
    await seedAll(db);
    network = new SimulatedNetwork(db);
  });

  it("seeds the design rooms as real shows", async () => {
    const lobby = await app().live.lobby();
    expect(lobby.live.map((s) => s.id)).toContain("glowlab");
    expect(lobby.upcoming.length).toBeGreaterThan(0);
    const room = await app().live.show("glowlab");
    expect(room?.messages.length).toBeGreaterThan(0);
    expect(room?.show.items.find((i) => i.status === "on-air")?.livePrice).toBeGreaterThan(0);
    // Viewers never see the stream key.
    expect(JSON.stringify(room)).not.toMatch(/streamKey/);
  });

  it("schedules a show with the shop's own products only, then goes live and pins", async () => {
    const r = await app().live.schedule(host, {
      title: "Lip swatches, round two",
      kind: "show",
      coverUrl: "/shop.svg",
      place: "Studio",
      scheduledFor: now,
      items: [
        { slug: "lip-set-velvet", livePrice: money.fromDollars(10) },
        { slug: "solar-panel-450w-bifacial", livePrice: money.fromDollars(1) },
      ],
    });
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value.items.map((i) => i.slug)).toEqual(["lip-set-velvet"]);
    expect((await app().live.start("sunvolt", r.value.id)).ok).toBe(false);
    expect((await app().live.start(host.sellerId, r.value.id)).ok).toBe(true);
    const studio = await app().live.studio(host.sellerId, r.value.id);
    expect(studio?.status).toBe("live");
    // Publishing needs the key; watching needs the show to be live.
    expect(await app().live.mayRead(`show-${r.value.id}`)).toBe(true);
    expect(await app().live.mayPublish(`show-${r.value.id}`, "wrong")).toBe(false);
    expect((await app().live.end(host.sellerId, r.value.id)).ok).toBe(true);
    expect(await app().live.mayRead(`show-${r.value.id}`)).toBe(false);
  });

  it("carries chat to everyone watching and marks the host", async () => {
    const received: LiveSignal[] = [];
    const stop = bus.subscribe("glowlab", (s) => received.push(s));
    const viewer = { accountId: newId(), name: "shopper-1", shops: [] };
    expect((await app().live.say(viewer, "glowlab", "  Shade 03 please  ")).ok).toBe(true);
    const fromHost = await app().live.say({ accountId: host.accountId, name: "shopper-x", shops: ["glowlab"] }, "glowlab", "Coming up!");
    expect(fromHost.ok && fromHost.value).toMatchObject({ host: true, name: "Ava" });
    stop();
    expect(received.map((s) => (s.message as { text: string }).text)).toEqual(["Shade 03 please", "Coming up!"]);
    expect((await app().live.say(viewer, "glowlab", "   ")).ok).toBe(false);
  });

  it("honours a held live price at checkout, then uses the hold up when the order is paid", async () => {
    const buyer = newId();
    const room = await app().live.show("glowlab");
    const onAir = room!.show.items.find((i) => i.status === "on-air")!;
    const held = await app().live.holdPrice(buyer, "glowlab", onAir.slug);
    expect(held.ok && held.value.price).toBe(onAir.livePrice);
    const order = await app().checkout({ buyerId: buyer, lines: [{ slug: onAir.slug, option: null, qty: 1 }], country: "GH", delivery: "cheapest", combineParcels: true, payDutiesNow: true, couponId: null, rail: "usdc-base", address: TEST_ADDRESS });
    if (!order.ok) throw new Error(order.error.message);
    expect(order.value.pricing.subtotal).toBe(money.fromDollars(onAir.livePrice!));
    // Someone without the hold pays the catalog price.
    const other = await app().checkout({ buyerId: newId(), lines: [{ slug: onAir.slug, option: null, qty: 1 }], country: "GH", delivery: "cheapest", combineParcels: true, payDutiesNow: true, couponId: null, rail: "usdc-base", address: TEST_ADDRESS });
    expect(other.ok && other.value.pricing.subtotal).toBeGreaterThan(money.fromDollars(onAir.livePrice!));

    const invoice = await new DrizzleInvoiceRepository(db).findById(order.value.invoiceId);
    await network.send(invoice!, now);
    await app().checkInvoice(order.value.invoiceId);
    const dispatcher = new OutboxDispatcher(db, eventHandlers(app()), { now: clock.now, maxAttempts: 1 });
    for (let i = 0; i < 5; i++) await dispatcher.dispatchOnce();
    expect(await app().live.bestHold(buyer, onAir.slug)).toBeNull();
  });

  it("runs an auction: racing bids, anti-sniping, and the winner's hold at the hammer price", async () => {
    const auction = await app().live.schedule({ accountId: newId(), name: "Lan", sellerId: "hustudio" }, { title: "Vases", kind: "auction", coverUrl: "/shop.svg", place: "", scheduledFor: now, items: [{ slug: "vase-qinghua-hand-painted", livePrice: null }] });
    if (!auction.ok) throw new Error(auction.error.message);
    expect((await app().live.addLot("hustudio", auction.value.id, { slug: "vase-qinghua-hand-painted", startPrice: money.fromDollars(40), increment: money.fromDollars(2), durationMs: 60_000 })).ok).toBe(false);
    await app().live.start("hustudio", auction.value.id);
    const opened = await app().live.addLot("hustudio", auction.value.id, { slug: "vase-qinghua-hand-painted", startPrice: money.fromDollars(40), increment: money.fromDollars(2), durationMs: 60_000 });
    if (!opened.ok) throw new Error(opened.error.message);
    const lotId = opened.value.id;

    const a = { accountId: newId(), name: "kofi_a" };
    const b = { accountId: newId(), name: "mei_l" };
    // Two bids at the same moment for the same amount: one wins, the other is told to bid higher.
    const [ra, rb] = await Promise.all([app().live.bid(a, lotId, money.fromDollars(40)), app().live.bid(b, lotId, money.fromDollars(40))]);
    expect([ra.ok, rb.ok].filter(Boolean)).toHaveLength(1);
    const loser = ra.ok ? b : a;
    now = new Date(now.getTime() + 55_000);
    const late = await app().live.bid(loser, lotId, money.fromDollars(42));
    expect(late.ok && new Date(late.value.endsAt).getTime()).toBe(now.getTime() + 10_000);
    expect(late.ok && late.value.topBid?.name).toMatch(/\*\*\*$/);

    now = new Date(now.getTime() + 11_000);
    expect(await app().live.closeDueLots()).toBe(1);
    expect((await app().live.lot(lotId))?.status).toBe("sold");
    const hold = await app().live.bestHold(loser.accountId, "vase-qinghua-hand-painted");
    expect(hold).toMatchObject({ price: money.fromDollars(42), qty: 1 });
    expect(bus.sent.some((m) => m.showId === auction.value.id && m.signal.type === "lot")).toBe(true);
  });
});
