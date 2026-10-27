import { domainError, err, ok, type DomainError, type Result } from "@/shared/kernel";

/**
 * How a person appears to everyone else: a handle (their address, /u/<handle>), a name, a
 * short bio and a photo. An account gets one the first time it's needed.
 */
export type Profile = Readonly<{
  accountId: string;
  handle: string;
  name: string;
  bio: string;
  /** A site path under /media/avatars/<accountId>/, or "" for none. */
  avatar: string;
  createdAt: Date;
  updatedAt: Date;
}>;

export type ProfileInput = Readonly<{ handle: string; name: string; bio: string; avatar: string }>;
export type ProfileError = DomainError<"invalid_handle" | "reserved_handle" | "invalid_name" | "invalid_bio" | "invalid_avatar">;

/** Letters, numbers, "_" and "."; 3–24 characters, not starting or ending with a dot. */
export const HANDLE = /^[a-z0-9_](?:[a-z0-9_.]{1,22})[a-z0-9_]$/;
export const MAX_NAME = 40;
export const MAX_BIO = 160;

/** Handles that would read as the platform speaking, or clash with a page. */
const RESERVED = new Set(["admin", "admins", "lychee", "support", "help", "official", "staff", "team", "moderator", "mod", "security", "shop", "shops", "sell", "seller", "me", "you", "api", "settings", "login", "signin", "signup", "root", "system"]);
/** Nor may a handle start with these, e.g. "lychee.support". */
const RESERVED_PREFIXES = ["admin", "lychee", "support", "official", "staff", "moderator", "security"];

/** The handle an account starts with: stable, and not personal. */
export const defaultHandle = (accountId: string) => `shopper_${accountId.replace(/-/g, "").slice(-6)}`;
/** The longer one, for the rare account whose short default someone else has. */
export const longDefaultHandle = (accountId: string) => `shopper_${accountId.replace(/-/g, "").slice(-12)}`;

export const isHandle = (h: string) => HANDLE.test(h) && !h.includes("..");

export function newProfile(accountId: string, at: Date, long = false): Profile {
  const handle = long ? longDefaultHandle(accountId) : defaultHandle(accountId);
  return { accountId, handle, name: handle, bio: "", avatar: "", createdAt: at, updatedAt: at };
}

/** Checks and applies an edit. The handle must also be free; the repository checks that. */
export function editProfile(p: Profile, input: ProfileInput, at: Date): Result<Profile, ProfileError> {
  const handle = input.handle.trim().replace(/^@/, "").toLowerCase();
  const name = input.name.trim().replace(/\s+/g, " ");
  const bio = input.bio.trim().replace(/\n{3,}/g, "\n\n");
  if (!isHandle(handle)) return err(domainError("invalid_handle", "Handles are 3–24 letters, numbers, _ or . (not at either end)."));
  if (handle !== p.handle && (RESERVED.has(handle) || RESERVED_PREFIXES.some((r) => handle.startsWith(r)))) return err(domainError("reserved_handle", "That handle is reserved."));
  // Default handles belong to the accounts they were made for.
  if (handle.startsWith("shopper_") && handle !== defaultHandle(p.accountId) && handle !== longDefaultHandle(p.accountId)) return err(domainError("reserved_handle", "That handle is reserved."));
  if (!name.length || name.length > MAX_NAME) return err(domainError("invalid_name", `Your name is 1–${MAX_NAME} characters.`));
  if (bio.length > MAX_BIO) return err(domainError("invalid_bio", `Keep your bio under ${MAX_BIO} characters.`));
  // Only a photo this account uploaded (or none).
  if (input.avatar && !new RegExp(`^/media/avatars/${p.accountId}/[a-z0-9-]+\\.(jpg|png|webp)$`).test(input.avatar)) return err(domainError("invalid_avatar", "Upload a photo first."));
  return ok({ ...p, handle, name, bio, avatar: input.avatar, updatedAt: at });
}

/** A follow between two people. Following yourself isn't a thing. */
export type Follow = Readonly<{ followerId: string; followeeId: string; at: Date }>;
