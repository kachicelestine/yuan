"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { MAX_BIO, MAX_NAME } from "@/modules/social";
import { profileTag } from "../cache-tags";
import { services } from "../container";
import { allow, RATE_LIMITED } from "../rate-limits";
import { currentAccount } from "../session";

type Failure = { ok: false; code: string; message: string };
const fail = (code: string, message: string): Failure => ({ ok: false, code, message });
const signedOut = () => fail("signed_out", "Sign in first.");

async function signedIn(): Promise<{ error: Failure } | { account: NonNullable<Awaited<ReturnType<typeof currentAccount>>>; app: Awaited<ReturnType<typeof services>> }> {
  const account = await currentAccount();
  if (!account) return { error: signedOut() };
  if (!(await allow("account.write", account.id))) return { error: RATE_LIMITED as Failure };
  return { account, app: await services() };
}

const Profile = z.object({
  handle: z.string().max(40),
  name: z.string().max(MAX_NAME + 20),
  bio: z.string().max(MAX_BIO + 40),
  avatar: z.string().max(300),
});

/** Saves the signed-in person's profile; the old and new handle pages refresh. */
export async function updateProfileAction(input: z.input<typeof Profile>): Promise<{ ok: true; handle: string } | Failure> {
  const s = await signedIn();
  if ("error" in s) return s.error;
  const p = Profile.safeParse(input);
  if (!p.success) return fail("invalid", "That couldn't be read.");
  const before = await s.app.profiles.me(s.account.id);
  const r = await s.app.profiles.update(s.account.id, p.data);
  if (!r.ok) return fail(r.error.code, r.error.message);
  updateTag(profileTag(before.handle));
  updateTag(profileTag(r.value.handle));
  return { ok: true, handle: r.value.handle };
}

/** A ticket to upload a profile photo straight to storage. */
export async function startAvatarAction(file: { contentType: string; bytes: number }): Promise<{ ok: true; url: string; headers: Record<string, string>; photo: string } | Failure> {
  const s = await signedIn();
  if ("error" in s) return s.error;
  const p = z.object({ contentType: z.string().max(100), bytes: z.number().int().positive() }).safeParse(file);
  if (!p.success) return fail("invalid", "That file couldn't be read.");
  const r = await s.app.profiles.startAvatar(s.account.id, p.data);
  return r.ok ? { ok: true, url: r.value.url, headers: { ...r.value.headers }, photo: r.value.photo } : fail(r.error.code, r.error.message);
}

/** Follow or unfollow a person by handle. */
export async function followPersonAction(handle: string, on: boolean): Promise<{ ok: true; followers: number; following: boolean } | Failure> {
  const s = await signedIn();
  if ("error" in s) return s.error;
  const p = z.object({ handle: z.string().min(3).max(40), on: z.boolean() }).safeParse({ handle, on });
  if (!p.success) return fail("invalid", "No one has that handle.");
  const r = await s.app.profiles.follow(s.account.id, p.data.handle, p.data.on);
  if (!r.ok) return fail(r.error.code, r.error.message);
  updateTag(profileTag(p.data.handle.toLowerCase()));
  return { ok: true, ...r.value };
}
