import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CopyEncoder } from "@/modules/content/infrastructure/copy-encoder";
import { reports, videoStats } from "@/modules/content/infrastructure/schema";
import { SimulatedNetwork } from "@/modules/payments/infrastructure/networks";
import { openDatabase, type Database } from "@/shared/infrastructure/database";
import { outbox } from "@/shared/infrastructure/platform-schema";
import { LocalStorage } from "@/shared/infrastructure/storage/local-storage";
import { fixedClock, newId } from "@/shared/kernel";
import { wire } from "./container";
import { seedAll } from "./seed";

describe("moderation", () => {
  let db: Database;
  let dir: string;
  let storage: LocalStorage;
  const clock = fixedClock("2026-10-24T16:00:00Z");
  const app = (premoderated = false) =>
    wire(db, { clock, payments: { network: new SimulatedNetwork(db), simulator: null }, media: { storage, privateStorage: storage, encoder: new CopyEncoder(storage), premoderated } });
  const moderator = newId();

  beforeAll(async () => {
    db = await openDatabase({ kind: "memory" });
    await seedAll(db);
    dir = await mkdtemp(join(tmpdir(), "lychee-moderation-"));
    storage = new LocalStorage({ dir, baseUrl: "/media", secret: "test-secret-test-secret-test-secret", now: () => clock.now() });
  });
  afterAll(() => rm(dir, { recursive: true, force: true }));

  it("counts one report per person, needs a note for 'other', and refuses missing items", async () => {
    const m = app().moderation;
    const [video] = await app().content.feedOrder();
    const person = newId();
    expect(await m.report(person, { targetType: "video", targetId: video, reason: "counterfeit", note: null })).toEqual({ ok: true, value: { counted: true } });
    expect(await m.report(person, { targetType: "video", targetId: video, reason: "spam", note: null })).toEqual({ ok: true, value: { counted: false } });
    expect((await m.report(newId(), { targetType: "video", targetId: video, reason: "other", note: " " })).ok).toBe(false);
    expect((await m.report(newId(), { targetType: "comment", targetId: "nope", reason: "spam", note: null })).ok).toBe(false);
    await m.report(newId(), { targetType: "video", targetId: video, reason: "misleading", note: "Logo is a copy" });
    const [top] = await m.queue();
    expect(top).toMatchObject({ targetType: "video", targetId: video, count: 2, notes: ["Logo is a copy"] });
    expect(top.reasons.sort()).toEqual(["counterfeit", "misleading"]);
  });

  it("takes a reported video down everywhere and closes its reports", async () => {
    const m = app().moderation;
    const [video] = await app().content.feedOrder();
    const r = await m.resolve(moderator, "video", video, "remove");
    expect(r).toEqual({ ok: true, value: { removed: true } });
    expect(await app().content.feedOrder()).not.toContain(video);
    expect(await app().content.videosByIds([video])).toEqual([]);
    expect((await m.queue()).map((i) => i.targetId)).not.toContain(video);
    const closed = await db.select().from(reports).where(eq(reports.targetId, video));
    expect(closed.every((x) => x.status === "actioned" && x.resolvedBy === moderator)).toBe(true);
    expect((await db.select().from(outbox)).filter((e) => e.topic === "ContentRemoved" && e.key === video)).toHaveLength(1);
  });

  it("removes a comment and its count; dismissing keeps the item", async () => {
    const m = app().moderation;
    const [video] = await app().content.feedOrder();
    const posted = await app().interactions.postComment({ accountId: newId(), name: "shopper-x", avatar: "" }, video, "Buy followers at spam.example");
    if (!posted.ok) throw new Error(posted.error.message);
    const before = (await db.select().from(videoStats).where(eq(videoStats.videoId, video)))[0].comments;
    await m.report(newId(), { targetType: "comment", targetId: posted.value.id, reason: "spam", note: null });
    await m.resolve(moderator, "comment", posted.value.id, "remove");
    expect((await app().content.comments(video)).map((c) => c.id)).not.toContain(posted.value.id);
    expect((await db.select().from(videoStats).where(eq(videoStats.videoId, video)))[0].comments).toBe(before - 1);

    const [, other] = await app().content.feedOrder();
    await m.report(newId(), { targetType: "video", targetId: other, reason: "offensive", note: null });
    expect(await m.resolve(moderator, "video", other, "dismiss")).toEqual({ ok: true, value: { removed: false } });
    expect(await app().content.feedOrder()).toContain(other);
  });

  it("approves uploads held for review", async () => {
    const me = { accountId: newId(), name: "shopper-y", avatar: "" };
    const ticket = await app(true).uploads.startUpload(me, { contentType: "video/mp4", bytes: 16 });
    if (!ticket.ok) throw new Error("ticket");
    await storage.receive(storage.verify(new URL(ticket.value.url, "http://x").searchParams)!, new Blob([new Uint8Array(16)]).stream());
    const posted = await app(true).uploads.publish(me, { key: ticket.value.key, productSlug: "hoodie-heavyweight", alsoSlugs: [], caption: "Fit check", tags: [], place: "" });
    if (!posted.ok) throw new Error(posted.error.message);
    await app(true).uploads.encodeNext();
    const pending = await app().moderation.pendingVideos();
    expect(pending.map((v) => v.id)).toContain(posted.value.videoId);
    expect((await app().moderation.approveVideo(posted.value.videoId)).ok).toBe(true);
    expect(await app().content.feedOrder()).toContain(posted.value.videoId);
    expect((await app().moderation.approveVideo(posted.value.videoId)).ok).toBe(false);
  });
});
