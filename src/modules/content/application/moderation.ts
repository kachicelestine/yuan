import { domainError, err, ok, type Clock, type DomainError, type EventLog, type Result } from "@/shared/kernel";
import { fileReport, type ReportError, type ReportReason, type ReportTarget } from "../domain/moderation";
import type { CommentRepository, QuestionRepository, ReportRepository, ReviewRepository, VideoRepository } from "../domain/repositories";
import { approve, remove, type VideoError } from "../domain/video";

export type ModerationScope = {
  videos: VideoRepository;
  comments: CommentRepository;
  questions: QuestionRepository;
  reviews: ReviewRepository;
  reports: ReportRepository;
  events: EventLog;
};

export type ModerationDeps = {
  reports: ReportRepository;
  videos: VideoRepository;
  comments: CommentRepository;
  questions: QuestionRepository;
  reviews: ReviewRepository;
  uow: { run<T>(work: (scope: ModerationScope) => Promise<T>): Promise<T> };
  clock: Clock;
  newId: () => string;
};

/** Something was taken down: caches that showed it refresh (feed, shop, product page). */
export type ContentRemoved = Readonly<{
  type: "ContentRemoved";
  targetType: ReportTarget;
  targetId: string;
  /** Where it appeared, so the right pages refresh. */
  videoId: string | null;
  productSlug: string | null;
  sellerId: string | null;
  at: Date;
}>;

export type ModerationError = ReportError | VideoError | DomainError<"not_found">;

/** One queue entry: the item, what people said, and enough to judge it. */
export type ModerationItemView = {
  targetType: ReportTarget;
  targetId: string;
  count: number;
  reasons: ReportReason[];
  notes: string[];
  firstAt: string;
  preview: { title: string; text: string; image: string | null; link: string | null };
};

/** A video waiting for approval. */
export type PendingVideoView = { id: string; caption: string; image: string; clip: string | null; productSlug: string; sellerId: string; authorId: string | null; at: string };

/** Reports from people, and the decisions moderators take on them and on new uploads. */
export function makeModeration({ reports, videos, comments, questions, reviews, uow, clock, newId }: ModerationDeps) {
  /** What's being reported, or null when it's already gone. */
  async function preview(targetType: ReportTarget, targetId: string): Promise<ModerationItemView["preview"] | null> {
    if (targetType === "video") {
      const v = await videos.find(targetId);
      return v && v.status !== "removed" ? { title: `Video · ${v.productSlug}`, text: v.caption, image: v.posterUrl || null, link: `/?v=${v.id}` } : null;
    }
    if (targetType === "comment") {
      const c = await comments.find(targetId);
      return c && { title: `Comment by ${c.authorName}`, text: c.text, image: null, link: c.targetType === "video" ? `/?v=${c.targetId}` : null };
    }
    if (targetType === "question") {
      const q = await questions.find(targetId);
      return q && { title: `Question by ${q.askerName}`, text: q.answer ? `${q.question}\nA: ${q.answer}` : q.question, image: null, link: `/p/${q.productSlug}` };
    }
    const r = await reviews.find(targetId);
    return r && { title: `Review by ${r.authorName} · ${r.rating}★`, text: r.text, image: r.photos[0] ?? null, link: `/p/${r.productSlug}` };
  }

  /** Deletes or hides the item; returns where it showed, or null if it was already gone. */
  async function takeDown(s: ModerationScope, targetType: ReportTarget, targetId: string): Promise<Omit<ContentRemoved, "type" | "targetType" | "targetId" | "at"> | null> {
    if (targetType === "video") {
      const v = await s.videos.find(targetId);
      if (!v) return null;
      await s.videos.save(remove(v));
      return { videoId: v.id, productSlug: v.productSlug, sellerId: v.sellerId };
    }
    if (targetType === "comment") {
      const c = await s.comments.remove(targetId);
      if (!c) return null;
      if (c.targetType === "video") await s.videos.bump(c.targetId, { comments: -1 });
      return { videoId: c.targetType === "video" ? c.targetId : null, productSlug: null, sellerId: null };
    }
    if (targetType === "question") {
      const q = await s.questions.remove(targetId);
      return q && { videoId: null, productSlug: q.productSlug, sellerId: q.sellerId };
    }
    const r = await s.reviews.remove(targetId);
    return r && { videoId: null, productSlug: r.productSlug, sellerId: r.sellerId };
  }

  return {
    /** Anyone signed in can report; reporting the same thing twice counts once. */
    async report(reporterId: string, input: { targetType: ReportTarget; targetId: string; reason: ReportReason; note: string | null }): Promise<Result<{ counted: boolean }, ModerationError>> {
      const filed = fileReport({ id: newId(), reporterId, ...input, at: clock.now() });
      if (!filed.ok) return filed;
      if (!(await preview(input.targetType, input.targetId))) return err(domainError("not_found", "That's already gone."));
      return ok({ counted: await reports.add(filed.value) });
    },

    /** Reported items, most reported first. Items already gone are closed on the way. */
    async queue(limit = 50): Promise<ModerationItemView[]> {
      const items = await reports.openItems(limit);
      const views: ModerationItemView[] = [];
      for (const item of items) {
        const p = await preview(item.targetType, item.targetId);
        if (!p) {
          await reports.resolve(item.targetType, item.targetId, "actioned", null, clock.now());
          continue;
        }
        views.push({ ...item, reasons: [...item.reasons], notes: [...item.notes], firstAt: item.firstAt.toISOString(), preview: p });
      }
      return views;
    },

    /** Remove the item, or dismiss the reports; either way its reports close. */
    async resolve(moderatorId: string, targetType: ReportTarget, targetId: string, action: "remove" | "dismiss"): Promise<Result<{ removed: boolean }, ModerationError>> {
      const at = clock.now();
      return uow.run(async (s) => {
        if (action === "dismiss") {
          await s.reports.resolve(targetType, targetId, "dismissed", moderatorId, at);
          return ok({ removed: false });
        }
        const where = await takeDown(s, targetType, targetId);
        await s.reports.resolve(targetType, targetId, "actioned", moderatorId, at);
        if (where) {
          const event: ContentRemoved = { type: "ContentRemoved", targetType, targetId, ...where, at };
          await s.events.record(targetId, event);
        }
        return ok({ removed: where !== null });
      });
    },

    /** Uploads waiting for a moderator, oldest first. */
    async pendingVideos(limit = 50): Promise<PendingVideoView[]> {
      return (await videos.listByStatus("review", limit)).map((v) => ({
        id: v.id,
        caption: v.caption,
        image: v.posterUrl,
        clip: v.renditions[0]?.url ?? null,
        productSlug: v.productSlug,
        sellerId: v.sellerId,
        authorId: v.authorId,
        at: v.createdAt.toISOString(),
      }));
    },

    async approveVideo(videoId: string): Promise<Result<true, ModerationError>> {
      const v = await videos.find(videoId);
      if (!v) return err(domainError("not_found", "No such video."));
      const done = approve(v, clock.now());
      if (!done.ok) return done;
      await uow.run(async (s) => {
        await s.videos.save(done.value.video);
        await s.events.record(videoId, done.value.event);
      });
      return ok(true);
    },
  };
}

export type Moderation = ReturnType<typeof makeModeration>;
