import { beforeAll, describe, expect, it } from "vitest";
import { openDatabase, type Database } from "@/shared/infrastructure/database";
import { newId, type ObjectStorage } from "@/shared/kernel";
import { makeProfiles } from "../application/profiles";
import { defaultHandle, editProfile, newProfile } from "../domain/profile";
import { DrizzleFollowRepository, DrizzleProfileRepository } from "./drizzle-social-repositories";

// Uploaded photos "exist" when their key is in this set.
const uploaded = new Set<string>();
const photos = {
  signUpload: async (key: string) => ({ url: `https://upload.test/${key}`, method: "PUT" as const, headers: {} }),
  head: async (key: string) => (uploaded.has(key) ? { key, bytes: 1, contentType: "image/jpeg" } : null),
} as unknown as ObjectStorage;

describe("profiles and follows on Postgres", () => {
  let db: Database;
  const now = new Date("2026-10-27T10:00:00Z");
  const profiles = () => makeProfiles({ profiles: new DrizzleProfileRepository(db), follows: new DrizzleFollowRepository(db), photos, clock: { now: () => now } });

  beforeAll(async () => {
    db = await openDatabase({ kind: "memory" });
  });

  it("checks handles, names, bios and photos", () => {
    const id = newId();
    const p = newProfile(id, now);
    expect(p.handle).toBe(defaultHandle(id));
    const edit = (patch: Partial<{ handle: string; name: string; bio: string; avatar: string }>) => editProfile(p, { handle: "mei.makes", name: "Mei", bio: "", avatar: "", ...patch }, now);
    expect(edit({}).ok).toBe(true);
    expect(edit({ handle: "@Mei.Makes" })).toMatchObject({ ok: true, value: { handle: "mei.makes" } });
    for (const handle of ["ab", ".mei", "mei.", "mei..makes", "mei makes", "x".repeat(25)]) expect(edit({ handle })).toMatchObject({ ok: false, error: { code: "invalid_handle" } });
    for (const handle of ["admin", "lychee_official", "support", "shopper_abcdef"]) expect(edit({ handle })).toMatchObject({ ok: false, error: { code: "reserved_handle" } });
    expect(edit({ name: "  " })).toMatchObject({ ok: false, error: { code: "invalid_name" } });
    expect(edit({ bio: "x".repeat(161) })).toMatchObject({ ok: false, error: { code: "invalid_bio" } });
    expect(edit({ avatar: "/media/avatars/someone-else/a.jpg" })).toMatchObject({ ok: false, error: { code: "invalid_avatar" } });
    expect(edit({ avatar: `/media/avatars/${id}/0193-abc.jpg` }).ok).toBe(true);
  });

  it("gives every account a profile on first use, and keeps handles unique", async () => {
    const a = newId();
    const b = newId();
    const mine = await profiles().me(a);
    expect(mine.handle).toBe(defaultHandle(a));
    expect((await profiles().me(a)).handle).toBe(mine.handle);

    expect(await profiles().update(a, { handle: "mei.makes", name: "Mei Lin", bio: "Hand-dyed silk, weekly drops.", avatar: "" })).toMatchObject({ ok: true, value: { handle: "mei.makes" } });
    expect(await profiles().update(b, { handle: "mei.makes", name: "Copycat", bio: "", avatar: "" })).toMatchObject({ ok: false, error: { code: "handle_taken" } });

    // A photo must have finished uploading.
    const ticket = await profiles().startAvatar(a, { contentType: "image/png", bytes: 1000 });
    if (!ticket.ok) throw new Error(ticket.error.message);
    expect(await profiles().update(a, { handle: "mei.makes", name: "Mei Lin", bio: "", avatar: ticket.value.photo })).toMatchObject({ ok: false, error: { code: "invalid_avatar" } });
    uploaded.add(ticket.value.photo.slice("/media/".length));
    expect(await profiles().update(a, { handle: "mei.makes", name: "Mei Lin", bio: "", avatar: ticket.value.photo })).toMatchObject({ ok: true, value: { avatar: ticket.value.photo } });
    expect((await profiles().startAvatar(a, { contentType: "image/gif", bytes: 10 })).ok).toBe(false);

    expect((await profiles().actor(a)).name).toBe("Mei Lin");
    const actors = await profiles().actors([a, b, newId()]);
    expect(actors.get(a)?.handle).toBe("mei.makes");
    expect(actors.size).toBe(3);
    expect((await profiles().search("mei", 5)).map((p) => p.handle)).toContain("mei.makes");
    expect(await profiles().search("%", 5)).toEqual([]);
  });

  it("follows and unfollows people, with counts and lists", async () => {
    const star = newId();
    const fans = [newId(), newId(), newId()];
    await profiles().update(star, { handle: "sora.fits", name: "Sora", bio: "", avatar: "" });

    for (const f of fans) expect(await profiles().follow(f, "Sora.Fits", true)).toMatchObject({ ok: true });
    // Following twice changes nothing.
    expect(await profiles().follow(fans[0], "sora.fits", true)).toMatchObject({ ok: true, value: { followers: 3 } });
    expect(await profiles().follow(star, "sora.fits", true)).toMatchObject({ ok: false, error: { code: "self_follow" } });
    expect(await profiles().follow(fans[0], "nobody.here", true)).toMatchObject({ ok: false, error: { code: "not_found" } });

    const page = await profiles().page("sora.fits", fans[1]);
    expect(page).toMatchObject({ followers: 3, following: 0, followedByViewer: true, isViewer: false });
    expect((await profiles().page("sora.fits", star))?.isViewer).toBe(true);
    expect(await profiles().followingIds(fans[2])).toEqual([star]);
    expect((await profiles().people(star, "followers")).length).toBe(3);

    expect(await profiles().follow(fans[1], "sora.fits", false)).toMatchObject({ ok: true, value: { followers: 2, following: false } });
    expect((await profiles().page("sora.fits", fans[1]))?.followedByViewer).toBe(false);
    expect(await profiles().page("nobody.here", null)).toBeNull();
  });
});
