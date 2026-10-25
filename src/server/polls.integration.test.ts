import { beforeAll, describe, expect, it } from "vitest";
import { SimulatedNetwork } from "@/modules/payments/infrastructure/networks";
import { openDatabase, type Database } from "@/shared/infrastructure/database";
import { newId } from "@/shared/kernel";
import { wire } from "./container";
import { seedAll } from "./seed";

describe("polls", () => {
  let db: Database;
  let now = new Date("2026-10-24T10:00:00Z");
  const app = () => wire(db, { clock: { now: () => now }, payments: { network: new SimulatedNetwork(db), simulator: null } });
  const asker = { accountId: newId(), name: "shopper-a1b2c3" };

  beforeAll(async () => {
    db = await openDatabase({ kind: "memory" });
    await seedAll(db);
  });

  it("collects one vote per person, reasons, and a changed mind", async () => {
    const made = await app().polls.create(asker, { question: "  Which   hoodie? ", slugs: ["hoodie-heavyweight", "earbuds-anc"] });
    if (!made.ok) throw new Error(made.error.message);
    const id = made.value.id;
    expect(id).toMatch(/^[a-z2-9]{8}$/);

    const friend = newId();
    expect((await app().polls.vote(id, { voter: asker.accountId, accountId: asker.accountId, name: "x", choice: 0, reason: null })).ok).toBe(false);
    expect((await app().polls.vote(id, { voter: friend, accountId: null, name: "A friend", choice: 5, reason: null })).ok).toBe(false);

    const v1 = await app().polls.vote(id, { voter: friend, accountId: null, name: "A friend", choice: 0, reason: "Warmer" });
    expect(v1.ok && v1.value).toMatchObject({ question: "Which hoodie?", total: 1, myVote: 0, comments: [{ text: "Warmer", pick: 0 }] });
    // Voting again replaces the vote; a different pick drops the old reason.
    const v2 = await app().polls.vote(id, { voter: friend, accountId: null, name: "A friend", choice: 1, reason: null });
    expect(v2.ok && v2.value).toMatchObject({ total: 1, myVote: 1, comments: [] });
    await app().polls.vote(id, { voter: newId(), accountId: null, name: "Kofi", choice: 1, reason: "Better reviews" });

    const seen = await app().polls.view(id, { voter: null, accountId: asker.accountId });
    expect(seen).toMatchObject({ yours: true, myVote: null, total: 2, open: true });
    expect(seen?.options.map((o) => o.votes)).toEqual([0, 2]);
    expect((await app().polls.mine(asker.accountId)).map((p) => p.id)).toContain(id);

    // A day later it's closed.
    now = new Date(now.getTime() + 25 * 3_600_000);
    expect((await app().polls.vote(id, { voter: newId(), accountId: null, name: "Late", choice: 0, reason: null })).ok).toBe(false);
    expect((await app().polls.view(id, { voter: null, accountId: null }))?.open).toBe(false);
  });

  it("needs two or three different products", async () => {
    expect((await app().polls.create(asker, { question: "", slugs: ["a", "a"] })).ok).toBe(false);
    expect((await app().polls.create(asker, { question: "", slugs: ["a", "b", "c", "d"] })).ok).toBe(false);
    expect(await app().polls.view("not-an-id", { voter: null, accountId: null })).toBeNull();
  });
});
