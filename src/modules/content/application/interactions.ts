import { domainError, err, ok, type Clock, type DomainError, type EventLog, type Result } from "@/shared/kernel";
import { answerQuestion, askQuestion, writeComment, type LikeTarget, type PostError } from "../domain/posts";
import type { CommentRepository, LikeRepository, NoteRepository, QuestionRepository, ReviewRepository, VideoRepository, WatchTally } from "../domain/repositories";
import { toCommentView, toQuestionView, type CommentView, type QuestionView } from "./views";

/** Who is acting, as other people will see them. */
export type Actor = Readonly<{ accountId: string; name: string; avatar: string }>;

/** Lets content check products without reading catalog tables. */
export interface ProductDirectory {
  find(slug: string): Promise<{ slug: string; sellerId: string; category: string; image: string } | null>;
}

export type InteractionScope = {
  likes: LikeRepository;
  videos: VideoRepository;
  comments: CommentRepository;
  notes: NoteRepository;
  questions: QuestionRepository;
  reviews: ReviewRepository;
  events: EventLog;
};

export type InteractionDeps = {
  /** Reads outside a transaction. */
  videos: VideoRepository;
  likes: LikeRepository;
  products: ProductDirectory;
  uow: { run<T>(work: (scope: InteractionScope) => Promise<T>): Promise<T> };
  clock: Clock;
  newId: () => string;
};

export type CommentPosted = Readonly<{ type: "CommentPosted"; commentId: string; videoId: string; authorId: string; at: Date }>;
export type QuestionAsked = Readonly<{ type: "QuestionAsked"; questionId: string; productSlug: string; sellerId: string; at: Date }>;

export type QuestionAnswered = Readonly<{ type: "QuestionAnswered"; questionId: string; productSlug: string; askerId: string | null; at: Date }>;

export type InteractionError = DomainError<"not_found"> | PostError;

const notFound = (what: string) => err(domainError("not_found", `That ${what} isn't available any more.`));

/** Thrown inside a transaction to roll it back when the target turns out not to exist. */
class Missing extends Error {}

/** Likes, votes, comments, questions and shares: the writes people make while browsing. */
export function makeInteractions({ videos, likes, products, uow, clock, newId }: InteractionDeps) {
  /**
   * One like (or vote) per person per target, with the target's counter kept in step in
   * the same transaction. Liking twice changes nothing; liking something that doesn't
   * exist rolls back and says so.
   */
  async function toggle(accountId: string, target: LikeTarget, id: string, on: boolean, bump: (s: InteractionScope, delta: number) => Promise<boolean>) {
    try {
      await uow.run(async (s) => {
        if ((await s.likes.set(accountId, target, id, on)) && !(await bump(s, on ? 1 : -1))) throw new Missing();
      });
      return true;
    } catch (error) {
      if (error instanceof Missing) return false;
      throw error;
    }
  }

  return {
    async likeVideo(accountId: string, videoId: string, liked: boolean): Promise<Result<{ liked: boolean }, InteractionError>> {
      const video = await videos.find(videoId);
      if (!video || video.status !== "ready") return notFound("video");
      if (!(await toggle(accountId, "video", videoId, liked, (s, d) => s.videos.bump(videoId, { likes: d })))) return notFound("video");
      return ok({ liked });
    },

    async likeComment(accountId: string, commentId: string, liked: boolean): Promise<Result<{ liked: boolean }, InteractionError>> {
      if (!(await toggle(accountId, "comment", commentId, liked, (s, d) => s.comments.bumpLikes(commentId, d)))) return notFound("comment");
      return ok({ liked });
    },

    async likeNote(accountId: string, noteId: string, liked: boolean): Promise<Result<{ liked: boolean }, InteractionError>> {
      if (!(await toggle(accountId, "note", noteId, liked, (s, d) => s.notes.bumpLikes(noteId, d)))) return notFound("post");
      return ok({ liked });
    },

    async voteQuestion(accountId: string, questionId: string, useful: boolean): Promise<Result<{ useful: boolean }, InteractionError>> {
      if (!(await toggle(accountId, "question", questionId, useful, (s, d) => s.questions.bumpVotes(questionId, d)))) return notFound("question");
      return ok({ useful });
    },

    async voteReview(accountId: string, reviewId: string, helpful: boolean): Promise<Result<{ helpful: boolean }, InteractionError>> {
      if (!(await toggle(accountId, "review", reviewId, helpful, (s, d) => s.reviews.bumpHelpful(reviewId, d)))) return notFound("review");
      return ok({ helpful });
    },

    async postComment(actor: Actor, videoId: string, text: string): Promise<Result<CommentView, InteractionError>> {
      const video = await videos.find(videoId);
      if (!video || video.status !== "ready") return notFound("video");
      const at = clock.now();
      const written = writeComment({
        id: newId(),
        targetType: "video",
        targetId: videoId,
        authorId: actor.accountId,
        authorName: actor.name,
        authorAvatar: actor.avatar,
        text,
        bySeller: false,
        createdAt: at,
      });
      if (!written.ok) return written;
      const comment = written.value;
      const event: CommentPosted = { type: "CommentPosted", commentId: comment.id, videoId, authorId: actor.accountId, at };
      await uow.run(async (s) => {
        await s.comments.add(comment);
        await s.videos.bump(videoId, { comments: 1 });
        await s.events.record(videoId, event);
      });
      return ok(toCommentView(comment, at));
    },

    async askQuestion(actor: Actor, productSlug: string, text: string): Promise<Result<QuestionView, InteractionError>> {
      const product = await products.find(productSlug);
      if (!product) return notFound("product");
      const at = clock.now();
      const asked = askQuestion({ id: newId(), productSlug, sellerId: product.sellerId, askerId: actor.accountId, askerName: actor.name, question: text, createdAt: at });
      if (!asked.ok) return asked;
      const question = asked.value;
      // The seller hears about it through the outbox (notifications).
      const event: QuestionAsked = { type: "QuestionAsked", questionId: question.id, productSlug, sellerId: product.sellerId, at };
      await uow.run(async (s) => {
        await s.questions.add(question);
        await s.events.record(productSlug, event);
      });
      return ok(toQuestionView(question));
    },

    /** A shop answers a question about one of its products. */
    async answerQuestion(sellerId: string, questionId: string, text: string): Promise<Result<QuestionView, InteractionError>> {
      const q = await uow.run((s) => s.questions.find(questionId));
      if (!q || q.sellerId !== sellerId) return notFound("question");
      const answered = answerQuestion(q, text);
      if (!answered.ok) return answered;
      const event: QuestionAnswered = { type: "QuestionAnswered", questionId, productSlug: q.productSlug, askerId: q.askerId, at: clock.now() };
      await uow.run(async (s) => {
        await s.questions.saveAnswer(answered.value);
        await s.events.record(questionId, event);
      });
      return ok(toQuestionView(answered.value));
    },

    /** Counted, not attributed: anyone can share. */
    async share(videoId: string): Promise<boolean> {
      return videos.bump(videoId, { shares: 1 });
    },

    /** Adds a batch of watching (already summed per video) to the counters. */
    async recordWatches(tallies: readonly WatchTally[]): Promise<void> {
      if (tallies.length) await videos.addWatches(tallies, clock.now().toISOString().slice(0, 10));
    },

    /** Which of these the person has liked (or voted useful). */
    async likedBy(accountId: string, target: LikeTarget, ids: readonly string[]): Promise<string[]> {
      return [...(await likes.likedBy(accountId, target, ids))];
    },
  };
}

export type Interactions = ReturnType<typeof makeInteractions>;
