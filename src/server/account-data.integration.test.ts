import { beforeAll, describe, expect, it } from "vitest";
import { coinBalances } from "@/modules/engagement/infrastructure/schema";
import { SimulatedNetwork } from "@/modules/payments/infrastructure/networks";
import { openDatabase, type Database } from "@/shared/infrastructure/database";
import { fixedClock, newId } from "@/shared/kernel";
import { accountData } from "./account-data";
import { wire } from "./container";
import { seedAll } from "./seed";

describe("account data on the server", () => {
  let db: Database;
  let clock = fixedClock("2026-10-24T10:00:00Z");
  const app = () => wire(db, { clock: { now: () => clock.now() }, payments: { network: new SimulatedNetwork(db), simulator: null } });
  const store = () => accountData(app());
  const device = {
    cart: [
      { slug: "hoodie-heavyweight", option: null, qty: 2, note: null },
      { slug: "earbuds-anc", option: null, qty: 1, note: "LIVE PRICE HELD" },
    ],
    saved: ["lamp-brass-pendant"],
    alerts: ["earbuds-anc"],
    watches: [{ slug: "power-station-2kwh", target: 399, autoBuy: false }],
    following: ["sunvolt"],
  };
  const give = (accountId: string, balance: number) => db.insert(coinBalances).values({ accountId, balance });

  beforeAll(async () => {
    db = await openDatabase({ kind: "memory" });
    await seedAll(db);
  });

  it("starts empty", async () => {
    const state = await store().load(newId());
    expect(state).toMatchObject({ cart: [], saved: [], alerts: [], watches: [], coupons: [], coins: 0, checkin: { streak: 0, claimedToday: false } });
  });

  it("merges a device into the account at sign-in, priced by the catalog", async () => {
    const id = newId();
    await store().save(id, { ...device, cart: [{ slug: "hoodie-heavyweight", option: null, qty: 3, note: null }], saved: ["glass-tea-set"] });
    const state = await store().merge(id, { ...device, coupons: ["welcome5", "nope"] });
    expect(state.cart.map((l) => [l.slug, l.qty])).toEqual([
      ["hoodie-heavyweight", 3],
      ["earbuds-anc", 1],
    ]);
    expect(state.cart[0].unitPrice).toBeGreaterThan(0);
    expect(state.cart[0].title).toBeTruthy();
    expect(state.saved).toEqual(["glass-tea-set", "lamp-brass-pendant"]);
    expect(state.watches).toEqual(device.watches);
    expect(state.coupons).toEqual(["welcome5"]);
    expect(state.following).toEqual(["sunvolt"]);

    // Merging the same device again changes nothing.
    expect(await store().merge(id, { ...device, coupons: ["welcome5"] })).toEqual(state);
  });

  it("saves later edits as the device has them", async () => {
    const id = newId();
    await store().merge(id, { ...device, coupons: [] });
    await store().save(id, { cart: [], saved: [], alerts: ["earbuds-anc", "earbuds-anc"], watches: [], following: ["glowlab"] });
    expect(await store().load(id)).toMatchObject({ cart: [], saved: [], alerts: ["earbuds-anc"], watches: [], following: ["glowlab"] });
  });

  it("drops bag lines that can no longer be bought", async () => {
    const id = newId();
    const state = await store().merge(id, { ...device, cart: [{ slug: "ev-sedan-export", option: null, qty: 1, note: null }, ...device.cart], coupons: [] });
    expect(state.cart.map((l) => l.slug)).toEqual(["hoodie-heavyweight", "earbuds-anc"]);
  });

  it("counts each shop's followers across accounts", async () => {
    const [a, b] = [newId(), newId()];
    await store().save(a, { ...device, following: ["mei", "pals"] });
    await store().save(b, { ...device, following: ["mei"] });
    const counts = await app().engagement.followerCounts();
    expect(counts.get("mei")).toBeGreaterThanOrEqual(2);
    expect(counts.get("pals")).toBeGreaterThanOrEqual(1);
  });

  it("pays a check-in once a day and grows the streak", async () => {
    const id = newId();
    const first = await app().engagement.checkIn(id);
    expect(first).toEqual({ coins: 10, earned: 10, checkin: { streak: 1, claimedToday: true } });
    expect((await app().engagement.checkIn(id)).earned).toBe(0);

    clock = fixedClock("2026-10-25T10:00:00Z");
    try {
      expect(await app().engagement.checkIn(id)).toEqual({ coins: 20, earned: 10, checkin: { streak: 2, claimedToday: true } });
    } finally {
      clock = fixedClock("2026-10-24T10:00:00Z");
    }
  });

  it("spends coins on a reward and puts its coupon in the wallet, together", async () => {
    const id = newId();
    await give(id, 900);
    const r = await app().engagement.redeem(id, "r-ship");
    expect(r).toEqual({ ok: true, value: { coins: 100, coupons: ["freeship"] } });

    const again = await app().engagement.redeem(id, "r-ship");
    expect(again.ok ? null : again.error.code).toBe("already_claimed");
    expect((await store().load(id)).coins).toBe(100);
  });

  it("refuses a reward the balance doesn't cover, and takes nothing", async () => {
    const id = newId();
    await give(id, 499);
    const r = await app().engagement.redeem(id, "r-5");
    expect(r.ok ? null : r.error.code).toBe("not_enough_coins");
    expect(await store().load(id)).toMatchObject({ coins: 499, coupons: [] });

    const unknown = await app().engagement.redeem(id, "r-nope");
    expect(unknown.ok ? null : unknown.error.code).toBe("unknown_reward");
  });

  it("never lets two spends overdraw", async () => {
    const id = newId();
    await give(id, 2000);
    // r-25 costs 2,000 and r-ship 800: only one of them fits.
    const results = await Promise.all([app().engagement.redeem(id, "r-25"), app().engagement.redeem(id, "r-ship")]);
    expect(results.filter((r) => r.ok)).toHaveLength(1);
    const coins = (await store().load(id)).coins;
    expect([0, 1200]).toContain(coins);
  });
});
