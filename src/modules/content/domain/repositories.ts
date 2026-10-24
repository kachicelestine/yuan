import type { Comment, LikeTarget, Note, Question, Review, TargetType } from "./posts";
import type { Video } from "./video";

/** Counters kept beside a video, updated as people interact. */
export type VideoStats = Readonly<{ likes: number; comments: number; saves: number; shares: number; views: number }>;

/** Watching, summed per video over a short window before it's written. */
export type WatchTally = Readonly<{ videoId: string; views: number; watchMs: number; completes: number }>;

export interface VideoRepository {
  find(id: string): Promise<Video | null>;
  findMany(ids: readonly string[]): Promise<Video[]>;
  save(video: Video): Promise<void>;
  /** Published videos, newest first. */
  listReady(filter: { sellerId?: string; sellerIds?: readonly string[]; category?: string; limit: number; offset?: number }): Promise<Video[]>;
  stats(ids: readonly string[]): Promise<Map<string, VideoStats>>;
  /** Adds (or subtracts) to counters; never goes below zero. False when there's no such video. */
  bump(id: string, delta: Partial<VideoStats>): Promise<boolean>;
  /** Adds watch tallies to the lifetime counters and to today's row. */
  addWatches(tallies: readonly WatchTally[], day: string): Promise<void>;
  /** Someone's own videos in any state, newest first. */
  listByAuthor(authorId: string, limit: number): Promise<Video[]>;
  /** True when a video was already made from this upload. */
  hasSource(sourceKey: string): Promise<boolean>;
  /**
   * Takes the oldest video waiting for encoding, leased until `leaseUntil` so no other
   * worker takes it meanwhile. Videos that have used up their attempts are skipped.
   */
  claimForEncoding(now: Date, leaseUntil: Date, maxAttempts: number): Promise<{ video: Video; attempt: number } | null>;
  /** Hands a claimed video back to wait until `retryAt`, noting why. */
  releaseEncoding(id: string, error: string, retryAt: Date): Promise<void>;
}

export interface CommentRepository {
  find(id: string): Promise<Comment | null>;
  add(comment: Comment): Promise<void>;
  /** Most-liked first, then newest. */
  top(targetType: TargetType, targetIds: readonly string[], perTarget: number): Promise<Map<string, Comment[]>>;
  /** Newest first, older than `before` when given. */
  list(targetType: TargetType, targetId: string, limit: number, before?: Date): Promise<Comment[]>;
  /** False when there's no such comment. */
  bumpLikes(id: string, delta: number): Promise<boolean>;
}

export interface NoteRepository {
  list(filter: { category?: string; limit: number }): Promise<Note[]>;
  find(id: string): Promise<Note | null>;
  /** False when there's no such note. */
  bumpLikes(id: string, delta: number): Promise<boolean>;
}

export interface ReviewRepository {
  forProduct(slug: string, limit: number): Promise<Review[]>;
  forSeller(sellerId: string, limit: number): Promise<Review[]>;
  /** Every rating for a product (for star counts), cheap to read. */
  ratings(slug: string): Promise<number[]>;
  exists(orderId: string, productSlug: string): Promise<boolean>;
  add(review: Review): Promise<void>;
  /** False when there's no such review. */
  bumpHelpful(id: string, delta: number): Promise<boolean>;
}

export interface QuestionRepository {
  /** Answered questions, most useful first. Unanswered ones wait in the seller's inbox. */
  forProduct(slug: string, limit: number): Promise<Question[]>;
  add(question: Question): Promise<void>;
  /** False when there's no such question. */
  bumpVotes(id: string, delta: number): Promise<boolean>;
}

/** Likes by people (one per person per target). */
export interface LikeRepository {
  /** True when this call changed anything (liking twice is a no-op). */
  set(accountId: string, targetType: LikeTarget, targetId: string, liked: boolean): Promise<boolean>;
  likedBy(accountId: string, targetType: LikeTarget, targetIds: readonly string[]): Promise<Set<string>>;
}
