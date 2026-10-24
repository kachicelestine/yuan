import { beforeAll, describe, expect, it } from "vitest";
import { likes, videoDaily, videoStats } from "@/modules/content/infrastructure/schema";
import { SimulatedNetwork } from "@/modules/payments/infrastructure/networks";
import { openDatabase, type Database } from "@/shared/infrastructure/database";
import { outbox } from "@/shared/infrastructure/platform-schema";
import { fixedClock, newId } from "@/shared/kernel";
import { wire } from "./container";
import { seedAll } from "./seed";

describe("content on the server", () => {
  let db: Database;
  const clock = fixedClock("2026-10-24T13:00:00Z");
  const app = () => wire(db, { clock, payments: { network: new SimulatedNetwork(db), simulator: null } });
  const actor = (accountId = newId()) => ({ accountId, name: "shopper-abc123", avatar: "" });
  const stats = async (videoId: string) => (await db.select().from(videoStats)).find((s) => s.videoId === videoId)!;

  beforeAll(async () => {
    db = await openDatabase({ kind: "memory" });
    await seedAll(db);
  });

  it("serves the seeded feed in ranked order with counters and top comments", async () => {
    const { content } = app();
    const order = await content.feedOrder();
    expect(order).toHaveLength(12);
    const all = await content.videosByIds(order);
    expect(all.map((v) => v.id)).toEqual(order);
    expect(all.find((v) => v.clip)?.clip).toMatch(/\.mp4/);
    const [first] = all;
    expect(first.likes).toBeGreaterThan(0);
    expect(first.views).toBe(first.likes * 14);
    expect(first.topComments.length).toBeLessThanOrEqual(3);
    expect(first.topComments[0]).toMatchObject({ name: expect.any(String), ago: expect.stringMatching(/^\d+[mhdw]$|^now$/) });
  });

  it("drops unknown ids and keeps the order asked for", async () => {
    const { content } = app();
    const order = await content.feedOrder();
    const asked = [order[2], "nope", order[0]];
    expect((await content.videosByIds(asked)).map((v) => v.id)).toEqual([order[2], order[0]]);
  });

  it("counts one like per person, and unliking takes it back", async () => {
    const { interactions } = app();
    const [videoId] = await app().content.feedOrder();
    const before = (await stats(videoId)).likes;
    const person = newId();
    expect((await interactions.likeVideo(person, videoId, true)).ok).toBe(true);
    await interactions.likeVideo(person, videoId, true);
    expect((await stats(videoId)).likes).toBe(before + 1);
    expect(await interactions.likedBy(person, "video", [videoId, "other"])).toEqual([videoId]);
    await interactions.likeVideo(person, videoId, false);
    expect((await stats(videoId)).likes).toBe(before);
  });

  it("refuses to like what doesn't exist, and leaves no like behind", async () => {
    const { interactions } = app();
    const person = newId();
    const r = await interactions.likeComment(person, "no-such-comment", true);
    expect(r.ok).toBe(false);
    expect((await db.select().from(likes)).filter((l) => l.accountId === person)).toHaveLength(0);
    expect((await interactions.likeVideo(person, "no-such-video", true)).ok).toBe(false);
  });

  it("posts a comment, counts it, and tells the outbox", async () => {
    const { interactions, content } = app();
    const [videoId] = await content.feedOrder();
    const before = (await stats(videoId)).comments;
    const r = await interactions.postComment(actor(), videoId, "  Does it   fit a 2m balcony?  ");
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value).toMatchObject({ text: "Does it fit a 2m balcony?", likes: 0, ago: "now", name: "shopper-abc123" });
    expect((await stats(videoId)).comments).toBe(before + 1);
    expect((await content.comments(videoId))[0].id).toBe(r.value.id);
    const events = (await db.select().from(outbox)).filter((e) => e.topic === "CommentPosted");
    expect(events.at(-1)).toMatchObject({ key: videoId });

    expect((await interactions.postComment(actor(), videoId, "   ")).ok).toBe(false);
  });

  it("keeps new questions off the product page until someone answers", async () => {
    const { interactions, content } = app();
    const slug = "hoodie-heavyweight";
    const before = await content.questionsForProduct(slug);
    const r = await interactions.askQuestion(actor(), slug, "Is the hood lined?");
    expect(r.ok && r.value.answer).toBe(null);
    expect(await content.questionsForProduct(slug)).toEqual(before);
    expect((await interactions.askQuestion(actor(), "no-such-product", "Is it real?")).ok).toBe(false);
  });

  it("adds watching to lifetime counters and to today's row", async () => {
    const { interactions, content } = app();
    const [a, b] = await content.feedOrder();
    const [beforeA, beforeB] = [await stats(a), await stats(b)];
    await interactions.recordWatches([
      { videoId: a, views: 3, watchMs: 21_000, completes: 1 },
      { videoId: b, views: 1, watchMs: 4_000, completes: 0 },
      { videoId: "gone", views: 9, watchMs: 1, completes: 0 },
    ]);
    await interactions.recordWatches([{ videoId: a, views: 1, watchMs: 5_000, completes: 0 }]);
    expect(await stats(a)).toMatchObject({ views: beforeA.views + 4, watchMs: beforeA.watchMs + 26_000, completes: beforeA.completes + 1 });
    expect((await stats(b)).views).toBe(beforeB.views + 1);
    const today = (await db.select().from(videoDaily)).filter((d) => d.day === "2026-10-24");
    expect(today.find((d) => d.videoId === a)).toMatchObject({ views: 4, watchMs: 26_000, completes: 1 });
    expect(today.find((d) => d.videoId === "gone")).toBeUndefined();
  });

  it("serves reviews, notes and shop videos", async () => {
    const { content } = app();
    const notes = await content.notes();
    expect(notes.length).toBe(18);
    expect(notes[0]).toMatchObject({ id: expect.any(String), image: expect.any(String) });
    const order = await content.feedOrder();
    const [video] = await content.videosByIds(order.slice(0, 1));
    const shop = await content.videosForSeller(video.sellerId);
    expect(shop.some((v) => v.id === video.id)).toBe(true);
  });
});
