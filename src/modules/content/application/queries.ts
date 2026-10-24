import type { Clock } from "@/shared/kernel";
import { rankFeed } from "../domain/ranking";
import type { CommentRepository, NoteRepository, QuestionRepository, ReviewRepository, VideoRepository, VideoStats } from "../domain/repositories";
import type { Video } from "../domain/video";
import { toCommentView, toNoteView, toQuestionView, toReviewView, toVideoView, type CommentView, type NoteView, type QuestionView, type ReviewView, type VideoView } from "./views";

export type ContentQueryDeps = {
  videos: VideoRepository;
  comments: CommentRepository;
  notes: NoteRepository;
  reviews: ReviewRepository;
  questions: QuestionRepository;
  clock: Clock;
};

/** How many recent videos the ranker considers. Past this, candidates need an index of their own. */
export const FEED_CANDIDATES = 1000;
/** Comments shown under a video before "more". */
export const TOP_COMMENTS = 3;

const NO_STATS: VideoStats = { likes: 0, comments: 0, saves: 0, shares: 0, views: 0 };

/** Read use cases for videos, notes, reviews and Q&A. Each returns views ready for the UI. */
export function makeContentQueries({ videos, comments, notes, reviews, questions, clock }: ContentQueryDeps) {
  const videoViews = async (list: Video[]): Promise<VideoView[]> => {
    const ids = list.map((v) => v.id);
    const [stats, top] = await Promise.all([videos.stats(ids), comments.top("video", ids, TOP_COMMENTS)]);
    const now = clock.now();
    return list.map((v) => toVideoView(v, stats.get(v.id), top.get(v.id) ?? [], now));
  };

  return {
    /** Every published video's id in feed order. Small enough to cache whole; pages are cut from it. */
    async feedOrder(): Promise<string[]> {
      const list = await videos.listReady({ limit: FEED_CANDIDATES });
      const stats = await videos.stats(list.map((v) => v.id));
      return rankFeed(
        list.map((v) => ({ id: v.id, publishedAt: v.publishedAt ?? v.createdAt, stats: stats.get(v.id) ?? NO_STATS })),
        clock.now(),
      );
    },

    /** Published videos in the order asked for; unknown or unpublished ids drop out. */
    async videosByIds(ids: readonly string[]): Promise<VideoView[]> {
      const found = new Map((await videos.findMany(ids)).filter((v) => v.status === "ready").map((v) => [v.id, v]));
      return videoViews(ids.flatMap((id) => found.get(id) ?? []));
    },

    /** The Following feed: newest first from the shops someone follows. */
    async videosFromSellers(sellerIds: readonly string[], offset: number, limit: number): Promise<VideoView[]> {
      return videoViews(await videos.listReady({ sellerIds, offset, limit }));
    },

    async videosForSeller(sellerId: string, limit = 24): Promise<VideoView[]> {
      return videoViews(await videos.listReady({ sellerId, limit }));
    },

    async videosInCategory(category: string, limit = 24): Promise<VideoView[]> {
      return videoViews(await videos.listReady({ category, limit }));
    },

    /** A video's thread, newest first; pass the last one's time to page back. */
    async comments(videoId: string, limit = 30, before?: Date): Promise<CommentView[]> {
      const now = clock.now();
      return (await comments.list("video", videoId, limit, before)).map((c) => toCommentView(c, now));
    },

    async notes(filter: { category?: string; limit?: number } = {}): Promise<NoteView[]> {
      return (await notes.list({ category: filter.category, limit: filter.limit ?? 60 })).map(toNoteView);
    },

    async reviewsForProduct(slug: string, limit = 20): Promise<ReviewView[]> {
      return (await reviews.forProduct(slug, limit)).map(toReviewView);
    },

    async reviewsForSeller(sellerId: string, limit = 20): Promise<ReviewView[]> {
      return (await reviews.forSeller(sellerId, limit)).map(toReviewView);
    },

    async questionsForProduct(slug: string, limit = 20): Promise<QuestionView[]> {
      return (await questions.forProduct(slug, limit)).map(toQuestionView);
    },
  };
}

export type ContentQueries = ReturnType<typeof makeContentQueries>;
