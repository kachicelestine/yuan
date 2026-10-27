import { domainError, err, newId, ok, type Clock, type DomainError, type ObjectStorage, type Result } from "@/shared/kernel";
import { editProfile, isHandle, newProfile, type Profile, type ProfileError, type ProfileInput } from "../domain/profile";
import type { FollowRepository, ProfileRepository } from "../domain/repositories";

export type ProfilesDeps = {
  profiles: ProfileRepository;
  follows: FollowRepository;
  /** Public storage, for profile photos. */
  photos: ObjectStorage;
  clock: Clock;
};

/** What anyone may see of a person. */
export type ProfileView = { accountId: string; handle: string; name: string; bio: string; avatar: string };
/** A profile page: the person, their counts, and whether the viewer follows them. */
export type ProfilePageView = ProfileView & { followers: number; following: number; followedByViewer: boolean; isViewer: boolean };
/** How someone appears next to what they post. */
export type ActorView = { accountId: string; handle: string; name: string; avatar: string };

const toView = (p: Profile): ProfileView => ({ accountId: p.accountId, handle: p.handle, name: p.name, bio: p.bio, avatar: p.avatar });

const PHOTO_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

export type FollowError = DomainError<"not_found" | "self_follow">;

/** Public profiles and follows between people. */
export function makeProfiles({ profiles, follows, photos, clock }: ProfilesDeps) {
  /** The account's profile, made with a default handle the first time it's asked for. */
  async function ensure(accountId: string): Promise<Profile> {
    const found = await profiles.find(accountId);
    if (found) return found;
    const fresh = newProfile(accountId, clock.now());
    if (await profiles.save(fresh)) return fresh;
    // Two first reads raced (the other one saved it), or another account has this short
    // default handle: then this one takes the longer default.
    const raced = await profiles.find(accountId);
    if (raced) return raced;
    const long = newProfile(accountId, clock.now(), true);
    await profiles.save(long);
    return (await profiles.find(accountId)) ?? long;
  }

  return {
    ensure,

    async me(accountId: string): Promise<ProfileView> {
      return toView(await ensure(accountId));
    },

    /** The name and photo to show next to something this account posts. */
    async actor(accountId: string): Promise<ActorView> {
      const p = await ensure(accountId);
      return { accountId, handle: p.handle, name: p.name, avatar: p.avatar };
    },

    /** Profiles for many accounts; any account without one gets its default now, so links resolve. */
    async actors(accountIds: readonly string[]): Promise<Map<string, ActorView>> {
      const ids = [...new Set(accountIds)];
      const found = new Map((await profiles.findMany(ids)).map((p) => [p.accountId, p]));
      for (const id of ids) if (!found.has(id)) found.set(id, await ensure(id));
      return new Map(ids.map((id) => [id, { accountId: id, handle: found.get(id)!.handle, name: found.get(id)!.name, avatar: found.get(id)!.avatar }]));
    },

    async update(accountId: string, input: ProfileInput): Promise<Result<ProfileView, ProfileError | DomainError<"handle_taken">>> {
      const p = await ensure(accountId);
      const edited = editProfile(p, input, clock.now());
      if (!edited.ok) return edited;
      if (edited.value.avatar && edited.value.avatar !== p.avatar && !(await photos.head(edited.value.avatar.slice("/media/".length)))) {
        return err(domainError("invalid_avatar", "That photo didn't finish uploading. Try again."));
      }
      if (!(await profiles.save(edited.value))) return err(domainError("handle_taken", "Someone already has that handle."));
      return ok(toView(edited.value));
    },

    /** A one-off upload ticket for a new profile photo. */
    async startAvatar(accountId: string, file: { contentType: string; bytes: number }): Promise<Result<{ url: string; method: "PUT"; headers: Readonly<Record<string, string>>; photo: string }, DomainError<"unsupported_type" | "too_large">>> {
      const ext = PHOTO_TYPES[file.contentType];
      if (!ext) return err(domainError("unsupported_type", "Upload a JPEG, PNG or WebP photo."));
      if (!Number.isSafeInteger(file.bytes) || file.bytes <= 0 || file.bytes > MAX_PHOTO_BYTES) return err(domainError("too_large", "Photos can be up to 8 MB."));
      const key = `avatars/${accountId}/${newId()}.${ext}`;
      const ticket = await photos.signUpload(key, file, 15 * 60);
      return ok({ ...ticket, photo: `/media/${key}` });
    },

    /** A profile page by handle; null when nobody has it. */
    async page(handle: string, viewerId: string | null): Promise<ProfilePageView | null> {
      const h = handle.toLowerCase();
      if (!isHandle(h)) return null;
      const p = await profiles.findByHandle(h);
      if (!p) return null;
      const [counts, followed] = await Promise.all([follows.counts([p.accountId]), viewerId && viewerId !== p.accountId ? follows.isFollowing(viewerId, p.accountId) : false]);
      const c = counts.get(p.accountId) ?? { followers: 0, following: 0 };
      return { ...toView(p), followers: c.followers, following: c.following, followedByViewer: followed, isViewer: viewerId === p.accountId };
    },

    async follow(followerId: string, handle: string, on: boolean): Promise<Result<{ followers: number; following: boolean }, FollowError>> {
      const p = isHandle(handle.toLowerCase()) ? await profiles.findByHandle(handle.toLowerCase()) : null;
      if (!p) return err(domainError("not_found", "No one has that handle."));
      if (p.accountId === followerId) return err(domainError("self_follow", "That's you."));
      // The follower gets a profile too, so they show up in follower lists.
      await ensure(followerId);
      await follows.set({ followerId, followeeId: p.accountId, at: clock.now() }, on);
      const counts = await follows.counts([p.accountId]);
      return ok({ followers: counts.get(p.accountId)?.followers ?? 0, following: on });
    },

    /** Account ids this person follows (for the Following feed). */
    async followingIds(accountId: string, limit = 500): Promise<string[]> {
      return follows.followees(accountId, limit);
    },

    /** People in a follower or following list. */
    async people(accountId: string, which: "followers" | "following", limit = 100): Promise<ProfileView[]> {
      const ids = which === "followers" ? await follows.followers(accountId, limit) : await follows.followees(accountId, limit);
      const found = new Map((await profiles.findMany(ids)).map((p) => [p.accountId, p]));
      return ids.flatMap((id) => (found.has(id) ? [toView(found.get(id)!)] : []));
    },

    async search(text: string, limit = 12): Promise<ProfileView[]> {
      const q = text.trim().replace(/^@/, "");
      if (q.length < 2) return [];
      return (await profiles.search(q, limit)).map(toView);
    },
  };
}

export type Profiles = ReturnType<typeof makeProfiles>;
