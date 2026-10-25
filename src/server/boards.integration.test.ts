import { beforeAll, describe, expect, it } from "vitest";
import { SimulatedNetwork } from "@/modules/payments/infrastructure/networks";
import { openDatabase, type Database } from "@/shared/infrastructure/database";
import { newId } from "@/shared/kernel";
import { wire } from "./container";
import { seedAll } from "./seed";

// Collections: your boards are yours to fill, rename, hide or delete; public ones can be
// opened by link and followed by others; private ones are invisible to everyone else.
describe("boards", () => {
  let db: Database;
  const now = new Date("2026-10-24T10:00:00Z");
  const app = () => wire(db, { clock: { now: () => now }, payments: { network: new SimulatedNetwork(db), simulator: null } });
  const ada = { accountId: newId(), name: "shopper-ada001" };
  const ben = newId();

  beforeAll(async () => {
    db = await openDatabase({ kind: "memory" });
    await seedAll(db, now);
  });

  it("seeds the creator boards as public boards with no made-up followers", async () => {
    const popular = await app().boards.popular(null);
    expect(popular.map((b) => b.name).sort()).toEqual(["Fit check essentials", "Glow-up under $30", "Off-grid in a weekend"]);
    expect(popular.every((b) => b.public && b.followers === 0 && !b.yours)).toBe(true);
  });

  it("makes, fills and edits a board, newest item first", async () => {
    const made = await app().boards.create(ada, "  Van   build ", true, "power-station-2kwh");
    if (!made.ok) throw new Error(made.error.message);
    expect(made.value).toMatchObject({ name: "Van build", slugs: ["power-station-2kwh"], yours: true, public: true });
    const id = made.value.id;
    await app().boards.toggle(ada.accountId, id, "balcony-solar-800w", true);
    await app().boards.toggle(ada.accountId, id, "balcony-solar-800w", true); // twice is still once
    expect((await app().boards.view(id, ada.accountId))?.slugs).toEqual(["balcony-solar-800w", "power-station-2kwh"]);
    await app().boards.toggle(ada.accountId, id, "power-station-2kwh", false);
    const renamed = await app().boards.edit(ada.accountId, id, { name: "Off the grid" });
    expect(renamed.ok && renamed.value).toMatchObject({ name: "Off the grid", slugs: ["balcony-solar-800w"] });
    expect((await app().boards.edit(ada.accountId, id, { name: "   " })).ok).toBe(false);
    // Someone else can't change it.
    expect((await app().boards.toggle(ben, id, "earbuds-anc", true)).ok).toBe(false);
    expect((await app().boards.remove(ben, id)).ok).toBe(false);
    expect((await app().boards.mine(ada.accountId)).map((b) => b.id)).toEqual([id]);
  });

  it("lets others follow a public board, and hides a private one completely", async () => {
    const r = await app().boards.create(ada, "Dorm setup", true, null);
    if (!r.ok) throw new Error(r.error.message);
    const id = r.value.id;
    expect((await app().boards.follow(ada.accountId, id, true)).ok).toBe(false); // not your own
    const followed = await app().boards.follow(ben, id, true);
    expect(followed.ok && followed.value).toMatchObject({ following: true, followers: 1, yours: false });
    expect((await app().boards.followed(ben)).map((b) => b.id)).toEqual([id]);

    await app().boards.edit(ada.accountId, id, { isPublic: false });
    expect(await app().boards.view(id, ben)).toBeNull();
    expect(await app().boards.view(id, null)).toBeNull();
    expect((await app().boards.view(id, ada.accountId))?.public).toBe(false);
    expect(await app().boards.followed(ben)).toEqual([]); // a hidden board drops out of their list
    expect((await app().boards.follow(ben, id, true)).ok).toBe(false);
  });

  it("ranks popular boards by followers and leaves out near-empty ones", async () => {
    const r = await app().boards.create(ada, "Two things", true, "earbuds-anc");
    if (!r.ok) throw new Error(r.error.message);
    await app().boards.toggle(ada.accountId, r.value.id, "keyboard-75-retro", true);
    expect((await app().boards.popular(null)).some((b) => b.id === r.value.id)).toBe(false); // under three items
    await app().boards.follow(ben, "glowup30", true);
    const top = await app().boards.popular(ben);
    expect(top[0]).toMatchObject({ id: "glowup30", followers: 1, following: true });
  });

  it("deletes a board and its follows", async () => {
    const r = await app().boards.create(ada, "Short-lived", true, null);
    if (!r.ok) throw new Error(r.error.message);
    await app().boards.follow(ben, r.value.id, true);
    expect((await app().boards.remove(ada.accountId, r.value.id)).ok).toBe(true);
    expect(await app().boards.view(r.value.id, ada.accountId)).toBeNull();
    expect((await app().boards.followed(ben)).some((b) => b.id === r.value.id)).toBe(false);
  });
});
