import { beforeAll, describe, expect, it } from "vitest";
import { DrizzleInvoiceRepository } from "@/modules/payments/infrastructure/drizzle-payments-repositories";
import { SimulatedNetwork } from "@/modules/payments/infrastructure/networks";
import { OutboxDispatcher } from "@/shared/infrastructure/outbox";
import { openDatabase, type Database } from "@/shared/infrastructure/database";
import { newId } from "@/shared/kernel";
import { wire } from "./container";
import { eventHandlers } from "./jobs/jobs";
import { seedAll } from "./seed";
import { TEST_ADDRESS } from "./test-address";

// Blind boxes: pick a sealed box from a real case, shake it for hints, pay, then open it.
// The shop sees which figure to send. Nothing reveals a box before it's paid for.
describe("blind boxes", () => {
  let db: Database;
  let network: SimulatedNetwork;
  let now = new Date("2026-10-25T10:00:00Z");
  const app = () => wire(db, { clock: { now: () => now }, payments: { network, simulator: network } });
  const buy = async (buyerId: string, qty: number) => {
    const r = await app().checkout({ buyerId, lines: [{ slug: "art-toy-blind-box", option: null, qty }], country: "NG", address: TEST_ADDRESS, delivery: "cheapest", combineParcels: true, payDutiesNow: true, couponId: null, rail: "usdc-base" });
    if (!r.ok) throw new Error(r.error.message);
    await network.send((await new DrizzleInvoiceRepository(db).findById(r.value.invoiceId))!, now);
    await app().checkInvoice(r.value.invoiceId);
    const d = new OutboxDispatcher(db, eventHandlers(app()), { now: () => now, maxAttempts: 1 });
    for (let i = 0; i < 10; i++) if ((await d.dispatchOnce()).claimed === 0) break;
    return r.value.orderId;
  };

  beforeAll(async () => {
    db = await openDatabase({ kind: "memory" });
    await seedAll(db, now);
    network = new SimulatedNetwork(db);
  });

  it("shows a case without giving away what's inside", async () => {
    const [series] = await app().blindBoxes.series();
    const m = await app().blindBoxes.machine(series.id, null);
    expect(m?.case).toMatchObject({ number: 1, size: 12, left: 12, shakesLeft: 3 });
    expect(JSON.stringify(m)).not.toContain('"boxes"');
    expect(m?.owned).toEqual([]);
  });

  it("holds a picked box, gives shake hints, and makes it the buyer's once paid", async () => {
    const [series] = await app().blindBoxes.series();
    const me = newId();
    const other = newId();
    const m = (await app().blindBoxes.machine(series.id, me))!;
    const picked = await app().blindBoxes.pick(me, m.case.id, 4);
    if (!picked.ok) throw new Error(picked.error.message);
    expect(picked.value.view.case.slots[4]).toBe("held");
    expect((await app().blindBoxes.machine(series.id, other))!.case.slots[4]).toBe("taken");
    const grab = await app().blindBoxes.pick(other, m.case.id, 4);
    expect(!grab.ok && grab.error.code).toBe("taken");

    const ruled: string[] = [];
    for (let i = 0; i < 3; i++) {
      const s = await app().blindBoxes.shake(me, m.case.id, 4);
      if (!s.ok) throw new Error(s.error.message);
      ruled.push(s.value.figureId!);
    }
    expect(new Set(ruled).size).toBe(3);
    const fourth = await app().blindBoxes.shake(me, m.case.id, 4);
    expect(!fourth.ok && fourth.error.code).toBe("no_shakes");
    // Opening before paying gives nothing away.
    expect((await app().blindBoxes.open(me, m.case.id, 4)).ok).toBe(false);

    const orderId = await buy(me, 2); // the held box, plus one picked for them
    const mine = (await app().blindBoxes.machine(series.id, me))!;
    expect(mine.owned).toHaveLength(2);
    expect(mine.owned.every((o) => o.figureId === null)).toBe(true);
    expect(mine.owned.some((o) => o.caseId === m.case.id && o.index === 4)).toBe(true);
    const opened = await app().blindBoxes.open(me, m.case.id, 4);
    if (!opened.ok) throw new Error(opened.error.message);
    expect(ruled).not.toContain(opened.value.figureId);
    expect((await app().blindBoxes.machine(series.id, me))!.owned.find((o) => o.index === 4)?.figureId).toBe(opened.value.figureId);
    expect((await app().blindBoxes.open(other, m.case.id, 4)).ok).toBe(false);

    // The shop sees which figures to send for the order.
    const sending = await app().blindBoxes.forOrders([orderId]);
    expect(sending).toHaveLength(2);
    expect(sending.every((s) => s.seriesTitle === "Night Market" && s.figure.name)).toBe(true);
    // A second delivery of the payment changes nothing.
    expect(await app().blindBoxes.paid(me, orderId, [{ slug: "art-toy-blind-box", qty: 2 }])).toBe(0);
  });

  it("lets a shop start, pause and replace a series for its own listing", async () => {
    const figures = ["a", "b", "c"].map((n) => ({ name: `Figure ${n}`, image: `/photos/${n}.jpg`, secret: false }));
    const input = { slug: "art-toy-blind-box", title: "Spring Garden", figures, secretOdds: 3, shakesPerCase: 2 };
    expect((await app().blindBoxes.createSeries("mei", input)).ok).toBe(false); // not their listing
    const busy = await app().blindBoxes.createSeries("pals", input);
    expect(!busy.ok && busy.error.message).toContain("already has a live series");
    const [old] = await app().blindBoxes.sellerSeries("pals");
    expect((await app().blindBoxes.setActive("pals", old.id, false)).ok).toBe(true);
    const tooFew = await app().blindBoxes.createSeries("pals", { ...input, figures: figures.slice(0, 1) });
    expect(tooFew.ok).toBe(false);
    const made = await app().blindBoxes.createSeries("pals", { ...input, figures: [...figures, { name: "Gold", image: "/photos/g.jpg", secret: true }], secretOdds: 60 });
    if (!made.ok) throw new Error(made.error.message);
    expect(made.value).toMatchObject({ title: "Spring Garden", active: true, secretOdds: 60, cases: 0, sold: 0 });
    expect((await app().blindBoxes.seriesFor("art-toy-blind-box"))?.id).toBe(made.value.id);
    expect((await app().blindBoxes.setActive("pals", old.id, true)).ok).toBe(false); // one live series per listing
    // Put things back for the next test.
    await app().blindBoxes.setActive("pals", made.value.id, false);
    await app().blindBoxes.setActive("pals", old.id, true);
  });

  it("lets a hold run out, and opens a new case when one sells out", async () => {
    const [series] = await app().blindBoxes.series();
    const slow = newId();
    const m = (await app().blindBoxes.machine(series.id, slow))!;
    const free = m.case.slots.findIndex((x) => x === "free");
    expect((await app().blindBoxes.pick(slow, m.case.id, free)).ok).toBe(true);
    now = new Date(now.getTime() + 31 * 60_000);
    expect((await app().blindBoxes.machine(series.id, newId()))!.case.slots[free]).toBe("free");
    expect(await app().blindBoxes.sweep()).toBeGreaterThanOrEqual(1);

    const left = (await app().blindBoxes.machine(series.id, null))!.case.left;
    await buy(newId(), left); // empties the first case
    const next = (await app().blindBoxes.machine(series.id, null))!;
    expect(next.case).toMatchObject({ number: 2, left: 12 });
  });
  it("sells a whole fresh case to one shopper, every box held until they pay", async () => {
    const [series] = await app().blindBoxes.series();
    const shopper = newId();
    const held = await app().blindBoxes.holdCase(shopper, series.id);
    if (!held.ok) throw new Error(held.error.message);
    expect(held.value.size).toBe(12);
    // Asking again returns the same case; other shoppers can't take its boxes.
    expect(await app().blindBoxes.holdCase(shopper, series.id)).toMatchObject({ ok: true, value: { caseId: held.value.caseId } });
    expect((await app().blindBoxes.pick(newId(), held.value.caseId, 0)).ok).toBe(false);
    // Everyone else gets the next case.
    expect((await app().blindBoxes.machine(series.id, null))!.case.number).toBeGreaterThan(held.value.caseNumber);

    const orderId = await buy(shopper, held.value.size);
    const boxes = (await app().blindBoxes.forOrders([orderId])).filter((b) => b.caseNumber === held.value.caseNumber);
    expect(boxes.length).toBe(12);
    // Every regular figure once, unless the secret took one's place.
    expect(new Set(boxes.map((b) => b.figure.name)).size).toBe(12);
  });
});
