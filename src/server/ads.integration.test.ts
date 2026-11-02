import { beforeAll, describe, expect, it } from "vitest";
import { SimulatedNetwork } from "@/modules/payments/infrastructure/networks";
import { DrizzleLedger } from "@/modules/payments/infrastructure/drizzle-payments-repositories";
import { journal } from "@/modules/payments";
import { openDatabase, type Database } from "@/shared/infrastructure/database";
import { money, newId } from "@/shared/kernel";
import { wire } from "./container";
import { seedAll } from "./seed";

// Shops advertise listings, win sponsored slots in an auction, and pay per tap from their
// balance, once per impression. Real wiring on in-memory Postgres.
describe("sponsored listings", () => {
  let db: Database;
  const clock = { now: () => new Date("2026-10-24T09:00:00Z") };
  const app = () => wire(db, { clock, payments: { network: new SimulatedNetwork(db), simulator: null }, });
  const balance = (sellerId: string) => app().escrow.available(sellerId);
  /** Gives a shop earnings to spend, as if parcels had been delivered. */
  async function fund(sellerId: string, dollars: number) {
    const j = journal({ id: newId(), reference: `test-fund:${newId()}`, memo: "test", at: clock.now(), entries: [
      { account: "platform:adjustments", amount: money.fromDollars(dollars) },
      { account: `seller:${sellerId}`, amount: money.cents(-money.fromDollars(dollars)) },
    ] });
    if (!j.ok) throw new Error(j.error.message);
    await new DrizzleLedger(db).post(j.value);
  }

  beforeAll(async () => {
    db = await openDatabase({ kind: "memory" });
    await seedAll(db);
  });

  it("only lets a shop advertise its own live listings", async () => {
    const theirs = (await app().catalog.listProducts({ seller: "sunvolt", limit: 1 }))[0];
    expect((await app().ads.create("mei", { name: "Steal", slugs: [theirs.slug], bid: money.fromDollars(0.3), dailyBudget: money.fromDollars(10) })).ok).toBe(false);
  });

  it("serves the best ad for a matching search and bills one tap per impression", async () => {
    const [a] = await app().catalog.listProducts({ seller: "sunvolt", limit: 1 });
    const solar = (await app().searchProducts({ text: "solar", sort: "best", limit: 20 })).find((p) => p.sellerId !== "sunvolt")!;
    await fund("sunvolt", 50);
    await fund(solar.sellerId, 50);
    const high = await app().ads.create("sunvolt", { name: "Panels", slugs: [a.slug], bid: money.fromDollars(0.8), dailyBudget: money.fromDollars(5) });
    const low = await app().ads.create(solar.sellerId, { name: "Ours", slugs: [solar.slug], bid: money.fromDollars(0.3), dailyBudget: money.fromDollars(5) });
    expect(high.ok && low.ok).toBe(true);

    const eligible = (await app().ads.promoted()).filter((e) => [a.slug, solar.slug].includes(e.slug));
    const served = await app().ads.serve(eligible, 1);
    expect(served).toHaveLength(1);
    expect(served[0].slug).toBe(a.slug);
    // Second price: just over the runner-up, well under the 80¢ bid.
    expect(served[0].price).toBe(0.31);

    const before = await balance("sunvolt");
    expect(await app().ads.click(served[0].token)).toEqual({ billed: true, slug: a.slug });
    expect(await balance("sunvolt")).toBe(before - 31);
    // The same impression tapped again is free.
    expect((await app().ads.click(served[0].token)).billed).toBe(false);
    expect(await balance("sunvolt")).toBe(before - 31);
    expect(await app().ledger.balance("platform:ads")).toBe(-31);

    const [view] = (await app().ads.list("sunvolt")).filter((c) => c.name === "Panels");
    expect(view.today).toEqual({ impressions: 1, clicks: 1, spend: 0.31 });
  });

  it("counts an ad once a day per shopper, however often they see it", async () => {
    const [before] = (await app().ads.list("sunvolt")).filter((c) => c.name === "Panels");
    const eligible = (await app().ads.promoted()).filter((e) => e.campaignId === before.id);
    for (const viewer of ["shopper-1", "shopper-1", "shopper-2", null]) expect(await app().ads.serve(eligible, 1, viewer)).toHaveLength(1);
    const [after] = (await app().ads.list("sunvolt")).filter((c) => c.name === "Panels");
    // Two shoppers, plus one request nobody could be told apart in.
    expect(after.today.impressions - before.today.impressions).toBe(3);
  });

  it("rejects forged and stale tokens", async () => {
    const eligible = await app().ads.promoted();
    const [s] = await app().ads.serve(eligible, 1);
    const [data, sig] = s.token.split(".");
    const forged = JSON.parse(Buffer.from(data, "base64url").toString());
    forged.p = 1;
    expect((await app().ads.click(`${Buffer.from(JSON.stringify(forged)).toString("base64url")}.${sig}`)).billed).toBe(false);
    const later = wire(db, { clock: { now: () => new Date(clock.now().getTime() + 31 * 60_000) }, payments: { network: new SimulatedNetwork(db), simulator: null } });
    expect((await later.ads.click(s.token)).billed).toBe(false);
  });

  it("stops serving a shop that can't pay, or a paused campaign", async () => {
    const broke = (await app().catalog.listProducts({ seller: "mei", limit: 1 }))[0];
    const r = await app().ads.create("mei", { name: "Qipao", slugs: [broke.slug], bid: money.fromDollars(5), dailyBudget: money.fromDollars(50) });
    expect(r.ok).toBe(true);
    const mine = (await app().ads.promoted()).filter((e) => e.sellerId === "mei");
    expect(await app().ads.serve(mine, 2)).toEqual([]);

    const panels = (await app().ads.list("sunvolt")).find((c) => c.name === "Panels")!;
    expect((await app().ads.update("sunvolt", panels.id, { status: "paused" })).ok).toBe(true);
    expect((await app().ads.promoted()).some((e) => e.campaignId === panels.id)).toBe(false);
    // Another shop can't touch it.
    expect((await app().ads.update("mei", panels.id, { status: "active" })).ok).toBe(false);
  });
  it("boosts a shop's video into For You and bills the tap once", async () => {
    const order = await app().content.feedOrder();
    const videos = await app().content.videosByIds(order);
    const video = videos.find((v) => v.sellerId === "streetlab") ?? videos[0];
    const other = video.sellerId === "sunvolt" ? "streetlab" : "sunvolt";
    await fund(video.sellerId, 20);
    // Only the shop whose product the video shows can boost it.
    expect((await app().ads.boost(other, { videoId: video.id, bid: money.fromDollars(0.4), dailyBudget: money.fromDollars(5) })).ok).toBe(false);
    expect((await app().ads.boost(video.sellerId, { videoId: "no-such-video", bid: money.fromDollars(0.4), dailyBudget: money.fromDollars(5) })).ok).toBe(false);
    const boost = await app().ads.boost(video.sellerId, { videoId: video.id, bid: money.fromDollars(0.4), dailyBudget: money.fromDollars(5) });
    if (!boost.ok) throw new Error(boost.error.message);
    expect(boost.value).toMatchObject({ videoId: video.id, slugs: [video.productSlug] });
    expect(boost.value.name).toMatch(/^Boost: /);

    // Boosts fill feed slides, not search slots.
    expect((await app().ads.promoted()).some((e) => e.campaignId === boost.value.id)).toBe(false);
    const eligible = (await app().ads.promotedVideos()).filter((e) => e.campaignId === boost.value.id);
    expect(eligible).toEqual([{ campaignId: boost.value.id, sellerId: video.sellerId, slug: video.productSlug, videoId: video.id }]);
    const [served] = await app().ads.serve(eligible, 1);
    expect(served).toMatchObject({ campaignId: boost.value.id, videoId: video.id });

    const before = await balance(video.sellerId);
    expect((await app().ads.click(served.token)).billed).toBe(true);
    expect((await app().ads.click(served.token)).billed).toBe(false);
    expect(await balance(video.sellerId)).toBeLessThan(before);
    await app().ads.update(video.sellerId, boost.value.id, { status: "paused" });
    expect((await app().ads.promotedVideos()).some((e) => e.campaignId === boost.value.id)).toBe(false);
  });

  it("sells ad credit that pays for taps before earnings and can never be withdrawn", async () => {
    const network = new SimulatedNetwork(db);
    const shop = wire(db, { clock, payments: { network, simulator: network } });
    const rail = network.rails[0];
    expect((await shop.buyAdCredit({ sellerId: "mei", amount: money.fromDollars(5), rail })).ok).toBe(false);
    expect((await shop.buyAdCredit({ sellerId: "mei", amount: money.fromDollars(5001), rail })).ok).toBe(false);
    expect((await shop.buyAdCredit({ sellerId: "mei", amount: money.fromDollars(10), rail: "not-a-rail" })).ok).toBe(false);

    const bought = await shop.buyAdCredit({ sellerId: "mei", amount: money.fromDollars(20), rail });
    if (!bought.ok) throw new Error(bought.error.message);
    // An unpaid invoice buys nothing.
    expect(await shop.escrow.adCredit("mei")).toBe(0);
    const treasury = await shop.ledger.balance(`treasury:${rail}`);

    await shop.simulatePayment!(bought.value.invoiceId);
    expect(await shop.checkInvoice(bought.value.invoiceId)).toMatchObject({ status: "paid", adSellerId: "mei" });
    await shop.checkInvoice(bought.value.invoiceId);
    expect(await shop.escrow.adCredit("mei")).toBe(2000);
    expect(await shop.ledger.balance(`treasury:${rail}`)).toBe(treasury + 2000);

    // It isn't earnings, so it can't come back out as a payout.
    expect(await shop.escrow.available("mei")).toBe(0);
    expect((await shop.escrow.requestPayout("mei", money.fromDollars(20))).ok).toBe(false);

    // A shop with no sales can now win a slot and pay for the tap.
    const mine = (await shop.ads.promoted()).filter((e) => e.sellerId === "mei");
    const [served] = await shop.ads.serve(mine, 1);
    expect((await shop.ads.click(served.token)).billed).toBe(true);
    const spent = money.fromDollars(served.price);
    expect(await shop.escrow.adCredit("mei")).toBe(2000 - spent);
    expect(await shop.escrow.available("mei")).toBe(0);

    // Credit goes first, earnings cover what's left, and nothing goes below zero.
    await fund("mei", 30);
    const credit = await shop.escrow.adCredit("mei");
    expect(await shop.escrow.chargeAds({ sellerId: "mei", amount: money.cents(credit + 500), reference: "test-split" })).toBe(true);
    expect(await shop.escrow.adCredit("mei")).toBe(0);
    expect(await shop.escrow.available("mei")).toBe(2500);
    expect(await shop.escrow.chargeAds({ sellerId: "mei", amount: money.fromDollars(26), reference: "test-too-much" })).toBe(false);
    expect(await shop.escrow.available("mei")).toBe(2500);
  });

  it("lets unpaid ad credit lapse, and still honours a late payment", async () => {
    const network = new SimulatedNetwork(db);
    const shop = wire(db, { clock, payments: { network, simulator: network } });
    const later = wire(db, { clock: { now: () => new Date(clock.now().getTime() + 31 * 60_000) }, payments: { network, simulator: network } });
    const bought = await shop.buyAdCredit({ sellerId: "sunvolt", amount: money.fromDollars(10), rail: network.rails[0] });
    if (!bought.ok) throw new Error(bought.error.message);
    const before = await shop.escrow.adCredit("sunvolt");

    expect(await later.checkInvoice(bought.value.invoiceId)).toMatchObject({ status: "expired" });
    expect(await shop.escrow.adCredit("sunvolt")).toBe(before);

    await later.simulatePayment!(bought.value.invoiceId);
    expect(await later.checkInvoice(bought.value.invoiceId)).toMatchObject({ status: "paid", late: true });
    expect(await shop.escrow.adCredit("sunvolt")).toBe(before + 1000);
  });
});
