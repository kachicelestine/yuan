import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { cleanTags } from "@/modules/content";
import { CopyEncoder } from "@/modules/content/infrastructure/copy-encoder";
import { openDatabase, type Database } from "@/shared/infrastructure/database";
import { LocalStorage } from "@/shared/infrastructure/storage/local-storage";
import { newId } from "@/shared/kernel";
import { wire } from "./container";
import { seedAll } from "./seed";

// Photo posts: upload a photo, post it with #hashtags (optionally tagging a product), find it
// on the hashtag page and the poster's profile, and take it down when it's reported.
describe("photo posts and hashtags", () => {
  let db: Database;
  let dir: string;
  let storage: LocalStorage;
  const now = new Date("2026-10-27T10:00:00Z");
  const app = () => wire(db, { clock: { now: () => now }, media: { storage, privateStorage: storage, encoder: new CopyEncoder(storage), premoderated: false } });

  beforeAll(async () => {
    db = await openDatabase({ kind: "memory" });
    await seedAll(db, now);
    dir = await mkdtemp(join(tmpdir(), "lychee-notes-"));
    storage = new LocalStorage({ dir, baseUrl: "/media", secret: "test-secret-test-secret-test-secret" });
  });
  afterAll(() => rm(dir, { recursive: true, force: true }));

  /** Uploads a small photo the way a browser would and returns its site path. */
  async function upload(accountId: string) {
    const actor = { accountId, name: "Mei", avatar: "" };
    const ticket = await app().photoPosts.startPhoto(actor, { contentType: "image/jpeg", bytes: 64 });
    if (!ticket.ok) throw new Error(ticket.error.message);
    const t = storage.verify(new URL(ticket.value.url, "http://x").searchParams);
    await storage.receive(t!, new Blob([new Uint8Array(64)]).stream());
    return { actor, photo: ticket.value.photo };
  }

  it("normalises hashtags", () => {
    expect(cleanTags(["#Solar", "solar", " #Van-Life ", "#露营", "", "#" + "x".repeat(41)])).toEqual(["solar", "vanlife", "露营"]);
  });

  it("posts a photo with hashtags and a product, and finds it by tag and author", async () => {
    const accountId = newId();
    const { actor, photo } = await upload(accountId);
    expect((await app().photoPosts.startPhoto(actor, { contentType: "image/gif", bytes: 10 })).ok).toBe(false);
    expect(await app().photoPosts.post(actor, { photo, caption: "  ", tags: [], productSlug: null, ratio: "tall" })).toMatchObject({ ok: false, error: { code: "invalid_caption" } });
    expect(await app().photoPosts.post(actor, { photo: `/media/notes/${newId()}/x.jpg`, caption: "Not mine", tags: [], productSlug: null, ratio: "tall" })).toMatchObject({ ok: false, error: { code: "invalid_photo" } });
    expect(await app().photoPosts.post(actor, { photo, caption: "Gone", tags: [], productSlug: "no-such-thing", ratio: "tall" })).toMatchObject({ ok: false, error: { code: "not_found" } });

    const r = await app().photoPosts.post(actor, { photo, caption: "Off-grid weekend, all on one panel #Solar #vanlife", tags: ["camping"], productSlug: "solar-panel-450w-bifacial", ratio: "wide" });
    if (!r.ok) throw new Error(r.error.message);
    expect(r.value).toMatchObject({ productSlug: "solar-panel-450w-bifacial", category: "energy", ratio: "wide", authorName: "Mei" });
    expect(r.value.tags?.sort()).toEqual(["camping", "solar", "vanlife"]);

    const tagged = await app().content.tagged("vanlife");
    expect(tagged.notes.map((n) => n.id)).toEqual([r.value.id]);
    expect((await app().content.notesByAuthor(accountId)).map((n) => n.id)).toEqual([r.value.id]);
    expect((await app().content.notes({ limit: 5 })).map((n) => n.id)).toContain(r.value.id);

    // Without a product it still posts.
    const plain = await upload(accountId);
    expect((await app().photoPosts.post(plain.actor, { photo: plain.photo, caption: "Morning tea", tags: [], productSlug: null, ratio: "square" })).ok).toBe(true);
  });

  it("lets people report a photo post and moderators take it down", async () => {
    const { actor, photo } = await upload(newId());
    const r = await app().photoPosts.post(actor, { photo, caption: "Something against the rules #oops", tags: [], productSlug: null, ratio: "tall" });
    if (!r.ok) throw new Error(r.error.message);
    expect((await app().moderation.report(newId(), { targetType: "note", targetId: r.value.id, reason: "spam", note: null })).ok).toBe(true);
    expect((await app().moderation.queue()).find((i) => i.targetId === r.value.id)?.preview.title).toMatch(/Photo post by Mei/);
    expect(await app().moderation.resolve(newId(), "note", r.value.id, "remove")).toMatchObject({ ok: true, value: { removed: true } });
    expect((await app().content.tagged("oops")).notes).toEqual([]);
  });

  it("finds videos by their caption hashtags", async () => {
    const order = await app().content.feedOrder();
    const videos = await app().content.videosByIds(order.slice(0, 40));
    const withTag = videos.find((v) => v.tags.length > 0);
    if (!withTag) return;
    expect((await app().content.tagged(withTag.tags[0])).videos.map((v) => v.id)).toContain(withTag.id);
  });
});
