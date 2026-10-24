import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { VideoEncoder } from "@/modules/content";
import { CopyEncoder } from "@/modules/content/infrastructure/copy-encoder";
import { FfmpegEncoder } from "@/modules/content/infrastructure/ffmpeg-encoder";
import { videos } from "@/modules/content/infrastructure/schema";
import { SimulatedNetwork } from "@/modules/payments/infrastructure/networks";
import { openDatabase, type Database } from "@/shared/infrastructure/database";
import { outbox } from "@/shared/infrastructure/platform-schema";
import { LocalStorage } from "@/shared/infrastructure/storage/local-storage";
import { domainError, err, fixedClock, newId } from "@/shared/kernel";
import { wire } from "./container";
import { seedAll } from "./seed";

const hasFfmpeg = spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status === 0;

describe("posting videos", () => {
  let db: Database;
  let dir: string;
  let storage: LocalStorage;
  const clock = fixedClock("2026-10-24T14:00:00Z");
  const app = (options: { premoderated?: boolean; encoder?: VideoEncoder } = {}) =>
    wire(db, {
      clock,
      payments: { network: new SimulatedNetwork(db), simulator: null },
      media: { storage, privateStorage: storage, encoder: options.encoder ?? new CopyEncoder(storage), premoderated: options.premoderated ?? false },
    });
  const actor = (accountId = newId()) => ({ accountId, name: "shopper-abc123", avatar: "" });
  const clip = new Uint8Array(2048).fill(7);

  /** What the browser does: get a ticket, PUT the bytes. */
  async function upload(who: ReturnType<typeof actor>, bytes = clip, type = "video/mp4") {
    const ticket = await app().uploads.startUpload(who, { contentType: type, bytes: bytes.length });
    if (!ticket.ok) throw new Error(ticket.error.message);
    const t = storage.verify(new URL(ticket.value.url, "http://x").searchParams);
    if (!t) throw new Error("ticket didn't verify");
    await storage.receive(t, new Blob([bytes]).stream());
    return ticket.value.key;
  }

  beforeAll(async () => {
    db = await openDatabase({ kind: "memory" });
    await seedAll(db);
    dir = await mkdtemp(join(tmpdir(), "lychee-media-"));
    storage = new LocalStorage({ dir, baseUrl: "/media", secret: "test-secret-test-secret-test-secret", now: () => clock.now() });
  });
  afterAll(() => rm(dir, { recursive: true, force: true }));

  it("refuses files that aren't video or are too big", async () => {
    const u = app().uploads;
    expect((await u.startUpload(actor(), { contentType: "image/png", bytes: 10 })).ok).toBe(false);
    expect((await u.startUpload(actor(), { contentType: "video/mp4", bytes: 400 * 1024 * 1024 })).ok).toBe(false);
  });

  it("holds an upload to its ticket", async () => {
    const ticket = await app().uploads.startUpload(actor(), { contentType: "video/mp4", bytes: 100 });
    if (!ticket.ok) throw new Error("no ticket");
    const params = new URL(ticket.value.url, "http://x").searchParams;
    const t = storage.verify(params)!;
    await expect(storage.receive(t, new Blob([new Uint8Array(101)]).stream())).rejects.toThrow(/larger/);
    await expect(storage.receive(t, new Blob([new Uint8Array(99)]).stream())).rejects.toThrow(/smaller/);
    params.set("bytes", "1000000");
    expect(storage.verify(params)).toBeNull();
  });

  it("publishes an upload, encodes it and puts it in the feed", async () => {
    const me = actor();
    const key = await upload(me);
    const posted = await app().uploads.publish(me, { key, productSlug: "hoodie-heavyweight", alsoSlugs: ["glass-tea-set", "nope"], caption: "Wore it for a week", tags: ["#Hoodie", "fit"], place: "Lagos" });
    expect(posted.ok).toBe(true);
    if (!posted.ok) return;
    const { videoId } = posted.value;
    expect((await app().uploads.mine(me.accountId))[0]).toMatchObject({ id: videoId, status: "processing" });
    expect(await app().content.videosByIds([videoId])).toEqual([]);

    expect(await app().uploads.encodeNext()).toEqual({ videoId, status: "ready" });
    const [video] = await app().content.videosByIds([videoId]);
    expect(video).toMatchObject({ caption: "Wore it for a week", tags: ["hoodie", "fit"], also: ["glass-tea-set"], clip: `/media/${key}` });
    // No poster from the copy encoder: the product photo stands in.
    expect(video.image).toMatch(/^https:/);
    expect(await app().content.feedOrder()).toContain(videoId);
    const topics = (await db.select().from(outbox)).filter((e) => e.key === videoId).map((e) => e.topic);
    expect(topics).toEqual(["VideoUploaded", "VideoPublished"]);
    expect(await app().uploads.encodeNext()).toBeNull();

    // The same upload can't be posted twice, and nobody else can post it.
    expect((await app().uploads.publish(me, { key, productSlug: "hoodie-heavyweight", alsoSlugs: [], caption: "again", tags: [], place: "" })).ok).toBe(false);
    expect((await app().uploads.publish(actor(), { key, productSlug: "hoodie-heavyweight", alsoSlugs: [], caption: "mine", tags: [], place: "" })).ok).toBe(false);
  });

  it("holds uploads for a moderator where uploads are pre-moderated", async () => {
    const me = actor();
    const key = await upload(me);
    const posted = await app({ premoderated: true }).uploads.publish(me, { key, productSlug: "hoodie-heavyweight", alsoSlugs: [], caption: "Check", tags: [], place: "" });
    if (!posted.ok) throw new Error(posted.error.message);
    expect(await app({ premoderated: true }).uploads.encodeNext()).toEqual({ videoId: posted.value.videoId, status: "review" });
    expect(await app().content.videosByIds([posted.value.videoId])).toEqual([]);
  });

  it("retries an encoder outage, and fails a file that can't be read", async () => {
    const me = actor();
    const key = await upload(me);
    const posted = await app().uploads.publish(me, { key, productSlug: "hoodie-heavyweight", alsoSlugs: [], caption: "Flaky", tags: [], place: "" });
    if (!posted.ok) throw new Error(posted.error.message);
    const down: VideoEncoder = { encode: async () => Promise.reject(new Error("disk full")) };
    expect(await app({ encoder: down }).uploads.encodeNext()).toEqual({ videoId: posted.value.videoId, status: "processing" });
    // Waiting for its retry time, so the queue looks empty for now.
    expect(await app({ encoder: down }).uploads.encodeNext()).toBeNull();
    const [row] = await db.select().from(videos).where(eq(videos.id, posted.value.videoId));
    expect(row).toMatchObject({ encodeAttempts: 1, encodeError: "disk full" });

    const key2 = await upload(me);
    const bad = await app().uploads.publish(me, { key: key2, productSlug: "hoodie-heavyweight", alsoSlugs: [], caption: "Broken", tags: [], place: "" });
    if (!bad.ok) throw new Error(bad.error.message);
    const unreadable: VideoEncoder = { encode: async () => err(domainError("unreadable", "nope")) };
    expect(await app({ encoder: unreadable }).uploads.encodeNext()).toEqual({ videoId: bad.value.videoId, status: "failed" });
  });

  it.skipIf(!hasFfmpeg)("encodes real footage with ffmpeg", async () => {
    // Two seconds of a bright test pattern, portrait, with a tone.
    const source = join(dir, "pattern.mp4");
    spawnSync("ffmpeg", ["-v", "error", "-f", "lavfi", "-i", "testsrc2=size=540x960:rate=30:duration=2", "-f", "lavfi", "-i", "sine=duration=2", "-shortest", "-pix_fmt", "yuv420p", "-y", source]);
    const me = actor();
    const key = await upload(me, new Uint8Array(await readFile(source)));
    const encoder = new FfmpegEncoder({ storage, threads: 2 });
    const posted = await app({ encoder }).uploads.publish(me, { key, productSlug: "hoodie-heavyweight", alsoSlugs: [], caption: "Real", tags: [], place: "" });
    if (!posted.ok) throw new Error(posted.error.message);
    expect(await app({ encoder }).uploads.encodeNext()).toEqual({ videoId: posted.value.videoId, status: "ready" });
    const [video] = await app().content.videosByIds([posted.value.videoId]);
    // 540 wide: only the 480 rung fits without upscaling.
    expect(video.renditions.map((r) => r.height)).toEqual([480]);
    expect(video.image).toBe(`/media/videos/${posted.value.videoId}/poster.jpg`);
    expect(await storage.head(`videos/${posted.value.videoId}/480.mp4`)).toMatchObject({ contentType: "video/mp4" });
  }, 60_000);
});
