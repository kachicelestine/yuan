"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { MAX_CAPTION, MAX_TAGGED, MAX_TAGS, MAX_UPLOAD_BYTES, UPLOAD_TYPES } from "@/modules/content";
import { actorFor } from "../actor";
import { profileTag } from "../cache-tags";
import { services } from "../container";
import { allow, RATE_LIMITED } from "../rate-limits";
import { currentAccount } from "../session";

type Failure = { ok: false; code: string; message: string };
const fail = (code: string, message: string): Failure => ({ ok: false, code, message });
const signedOut = () => fail("signed_out", "Sign in to post a video.");

const UploadFile = z.object({ contentType: z.enum(Object.keys(UPLOAD_TYPES) as [string, ...string[]]), bytes: z.number().int().positive().max(MAX_UPLOAD_BYTES) });

/** Step 1: a ticket to upload one file straight to storage. */
export async function startUploadAction(file: { contentType: string; bytes: number }): Promise<{ ok: true; key: string; url: string; method: "PUT"; headers: Record<string, string> } | Failure> {
  const account = await currentAccount();
  if (!account) return signedOut();
  if (!(await allow("content.upload", account.id))) return RATE_LIMITED;
  const parsed = UploadFile.safeParse(file);
  if (!parsed.success) return fail("invalid", `Upload an MP4, MOV or WebM video up to ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`);
  const r = await (await services()).uploads.startUpload(await actorFor(account), parsed.data);
  return r.ok ? { ok: true, ...r.value, headers: { ...r.value.headers } } : fail(r.error.code, r.error.message);
}

const slug = z.string().min(1).max(120);
const Post = z.object({
  key: z.string().min(1).max(256),
  productSlug: slug,
  alsoSlugs: z.array(slug).max(MAX_TAGGED - 1).default([]),
  caption: z.string().max(MAX_CAPTION),
  tags: z.array(z.string().max(40)).max(MAX_TAGS).default([]),
  place: z.string().max(80).default(""),
});

/** Step 2: the file is up; post it. It shows once encoded (and approved, where uploads are moderated). */
export async function publishVideoAction(input: z.input<typeof Post>): Promise<{ ok: true; videoId: string } | Failure> {
  const account = await currentAccount();
  if (!account) return signedOut();
  if (!(await allow("content.upload", account.id))) return RATE_LIMITED;
  const parsed = Post.safeParse(input);
  if (!parsed.success) return fail("invalid", "Check the caption and tags.");
  const r = await (await services()).uploads.publish(await actorFor(account), parsed.data);
  return r.ok ? { ok: true, videoId: r.value.videoId } : fail(r.error.code, r.error.message);
}

/** Photo posts, step 1: a ticket to upload the photo. */
export async function startNotePhotoAction(file: { contentType: string; bytes: number }): Promise<{ ok: true; url: string; headers: Record<string, string>; photo: string } | Failure> {
  const account = await currentAccount();
  if (!account) return fail("signed_out", "Sign in to post.");
  if (!(await allow("content.upload", account.id))) return RATE_LIMITED;
  const p = z.object({ contentType: z.string().max(100), bytes: z.number().int().positive() }).safeParse(file);
  if (!p.success) return fail("invalid", "That file couldn't be read.");
  const r = await (await services()).photoPosts.startPhoto(await actorFor(account), p.data);
  return r.ok ? { ok: true, url: r.value.url, headers: { ...r.value.headers }, photo: r.value.photo } : fail(r.error.code, r.error.message);
}

const NotePost = z.object({
  photo: z.string().max(300),
  caption: z.string().max(400),
  tags: z.array(z.string().max(40)).max(MAX_TAGS).default([]),
  productSlug: slug.nullable().default(null),
  ratio: z.enum(["tall", "square", "wide"]),
});

/** Photo posts, step 2: post it to Discover, your profile and its hashtags. */
export async function postNoteAction(input: z.input<typeof NotePost>): Promise<{ ok: true; id: string; inReview: boolean } | Failure> {
  const account = await currentAccount();
  if (!account) return fail("signed_out", "Sign in to post.");
  if (!(await allow("content.upload", account.id))) return RATE_LIMITED;
  const p = NotePost.safeParse(input);
  if (!p.success) return fail("invalid", "Check the caption and tags.");
  const app = await services();
  const r = await app.photoPosts.post(await actorFor(account), p.data);
  if (!r.ok) return fail(r.error.code, r.error.message);
  // Unless a moderator has to see it first, the poster sees it straight away on Discover and their profile.
  if (r.value.inReview) return { ok: true, id: r.value.id, inReview: true };
  updateTag("notes");
  updateTag(profileTag((await app.profiles.me(account.id)).handle));
  return { ok: true, id: r.value.id, inReview: false };
}
