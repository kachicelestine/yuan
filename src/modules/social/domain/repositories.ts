import type { Follow, Profile } from "./profile";

export interface ProfileRepository {
  find(accountId: string): Promise<Profile | null>;
  findByHandle(handle: string): Promise<Profile | null>;
  findMany(accountIds: readonly string[]): Promise<Profile[]>;
  /** Saves; false when another account already has the handle. */
  save(profile: Profile): Promise<boolean>;
  search(text: string, limit: number): Promise<Profile[]>;
}

export type FollowCounts = { followers: number; following: number };

export interface FollowRepository {
  /** Turns a follow on or off; true when that changed anything. */
  set(follow: Follow, on: boolean): Promise<boolean>;
  isFollowing(followerId: string, followeeId: string): Promise<boolean>;
  /** Who this account follows, newest first. */
  followees(followerId: string, limit: number): Promise<string[]>;
  followers(followeeId: string, limit: number): Promise<string[]>;
  counts(accountIds: readonly string[]): Promise<Map<string, FollowCounts>>;
}
