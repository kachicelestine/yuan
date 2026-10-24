"use server";

import { z } from "zod";
import { REPORT_REASONS, REPORT_TARGETS, type CommentView, type LikeTarget, type QuestionView } from "@/modules/content";
import { actorFor } from "../actor";
import { services } from "../container";
import { allow, clientIp, RATE_LIMITED } from "../rate-limits";
import { currentAccount } from "../session";

type Failure = { ok: false; code: string; message: string };
const fail = (code: string, message: string): Failure => ({ ok: false, code, message });
const signedOut = () => fail("signed_out", "Sign in to join in.");

const id = z.string().min(1).max(64);
const target = z.enum(["video", "note", "comment", "question", "review"]) satisfies z.ZodType<LikeTarget>;
const Reaction = z.object({ target, id, on: z.boolean() });

/** Like or unlike (or vote useful / not) anything people can react to. */
export async function reactAction(input: { target: LikeTarget; id: string; on: boolean }): Promise<{ ok: true; on: boolean } | Failure> {
  const account = await currentAccount();
  if (!account) return signedOut();
  if (!(await allow("content.react", account.id))) return RATE_LIMITED;
  const parsed = Reaction.safeParse(input);
  if (!parsed.success) return fail("invalid", "That couldn't be read.");
  const { target: t, id: targetId, on } = parsed.data;
  const i = (await services()).interactions;
  const r =
    t === "video"
      ? await i.likeVideo(account.id, targetId, on)
      : t === "note"
        ? await i.likeNote(account.id, targetId, on)
        : t === "comment"
          ? await i.likeComment(account.id, targetId, on)
          : t === "question"
            ? await i.voteQuestion(account.id, targetId, on)
            : await i.voteReview(account.id, targetId, on);
  return r.ok ? { ok: true, on } : fail(r.error.code, r.error.message);
}

export async function postCommentAction(videoId: string, text: string): Promise<{ ok: true; comment: CommentView } | Failure> {
  const account = await currentAccount();
  if (!account) return signedOut();
  if (!(await allow("content.post", account.id))) return RATE_LIMITED;
  const v = id.safeParse(videoId);
  const t = z.string().max(2000).safeParse(text);
  if (!v.success || !t.success) return fail("invalid", "That comment couldn't be read.");
  const r = await (await services()).interactions.postComment(actorFor(account), v.data, t.data);
  return r.ok ? { ok: true, comment: r.value } : fail(r.error.code, r.error.message);
}

export async function askQuestionAction(productSlug: string, text: string): Promise<{ ok: true; question: QuestionView } | Failure> {
  const account = await currentAccount();
  if (!account) return signedOut();
  if (!(await allow("content.post", account.id))) return RATE_LIMITED;
  const s = z.string().min(1).max(120).safeParse(productSlug);
  const t = z.string().max(2000).safeParse(text);
  if (!s.success || !t.success) return fail("invalid", "That question couldn't be read.");
  const r = await (await services()).interactions.askQuestion(actorFor(account), s.data, t.data);
  return r.ok ? { ok: true, question: r.value } : fail(r.error.code, r.error.message);
}

/** Counts a share. Anyone can share, so it's limited per IP rather than per account. */
export async function shareAction(videoId: string): Promise<{ ok: boolean }> {
  const v = id.safeParse(videoId);
  if (!v.success || !(await allow("content.react", await clientIp()))) return { ok: false };
  return { ok: await (await services()).interactions.share(v.data) };
}

const Report = z.object({
  targetType: z.enum(REPORT_TARGETS),
  targetId: z.string().min(1).max(64),
  reason: z.enum(REPORT_REASONS),
  note: z.string().max(1000).nullable(),
});

/** Flags a video, comment, question or review for a moderator. */
export async function reportAction(input: z.input<typeof Report>): Promise<{ ok: true } | Failure> {
  const account = await currentAccount();
  if (!account) return fail("signed_out", "Sign in to report.");
  if (!(await allow("content.post", account.id))) return RATE_LIMITED;
  const parsed = Report.safeParse(input);
  if (!parsed.success) return fail("invalid", "Pick what's wrong.");
  const r = await (await services()).moderation.report(account.id, parsed.data);
  return r.ok ? { ok: true } : fail(r.error.code, r.error.message);
}
