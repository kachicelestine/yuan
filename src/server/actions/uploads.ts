"use server";

import { z } from "zod";
import { MAX_CAPTION, MAX_TAGGED, MAX_TAGS, MAX_UPLOAD_BYTES, UPLOAD_TYPES } from "@/modules/content";
import { actorFor } from "../actor";
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
