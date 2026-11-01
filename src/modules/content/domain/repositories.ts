import type { Report, ReportStatus, ReportReason, ReportTarget } from "./moderation";
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
  /** Videos in one state, oldest first (moderation queues). */
  listByStatus(status: Video["status"], limit: number): Promise<Video[]>;
  /** Published videos, newest first. */
  listReady(filter: { sellerId?: string; sellerIds?: readonly string[]; authorIds?: readonly string[]; category?: string; limit: number; offset?: number }): Promise<Video[]>;
  /** Published videos whose caption, place or tags match, or that show one of these products. */
  search(text: string, productSlugs: readonly string[], limit: number): Promise<Video[]>;
  stats(ids: readonly string[]): Promise<Map<string, VideoStats>>;
  /** Adds (or subtracts) to counters; never goes below zero. False when there's no such video. */
  bump(id: string, delta: Partial<VideoStats>): Promise<boolean>;
  /** Adds watch tallies to the lifetime counters and to today's row. */
  addWatches(tallies: readonly WatchTally[], day: string): Promise<void>;
  /** Someone's own videos in any state, newest first. */
  listByAuthor(authorId: string, limit: number): Promise<Video[]>;
  /** Published videos with this hashtag, newest first. */
  listReadyByTag(tag: string, limit: number): Promise<Video[]>;
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
  /** Deletes a comment, returning what was removed. */
  remove(id: string): Promise<Comment | null>;
}

export interface NoteRepository {
  list(filter: { category?: string; limit: number }): Promise<Note[]>;
  find(id: string): Promise<Note | null>;
  add(note: Note): Promise<void>;
  listByAuthor(authorId: string, limit: number): Promise<Note[]>;
  listByTag(tag: string, limit: number): Promise<Note[]>;
  listInReview(limit: number): Promise<Note[]>;
  /** Puts a note in public; false when there's no such note. */
  approve(id: string): Promise<boolean>;
  /** Deletes a note (a takedown); returns it, or null if it was already gone. */
  remove(id: string): Promise<Note | null>;
  /** False when there's no such note. */
  bumpLikes(id: string, delta: number): Promise<boolean>;
}

export interface ReviewRepository {
  forProduct(slug: string, limit: number): Promise<Review[]>;
  /** How many reviews this account has written. */
  countByAuthor(accountId: string): Promise<number>;
  forSeller(sellerId: string, limit: number): Promise<Review[]>;
  /** Every rating for a product (for star counts), cheap to read. */
  ratings(slug: string): Promise<number[]>;
  exists(orderId: string, productSlug: string): Promise<boolean>;
  find(id: string): Promise<Review | null>;
  add(review: Review): Promise<void>;
  remove(id: string): Promise<Review | null>;
  /** False when there's no such review. */
  bumpHelpful(id: string, delta: number): Promise<boolean>;
}

export interface QuestionRepository {
  /** Answered questions, most useful first. Unanswered ones wait in the seller's inbox. */
  forProduct(slug: string, limit: number): Promise<Question[]>;
  find(id: string): Promise<Question | null>;
  /** Questions waiting for this shop's answer, oldest first. */
  unansweredForSeller(sellerId: string, limit: number): Promise<Question[]>;
  add(question: Question): Promise<void>;
  /** Writes the answer (the question itself never changes). */
  saveAnswer(question: Question): Promise<void>;
  remove(id: string): Promise<Question | null>;
  /** False when there's no such question. */
  bumpVotes(id: string, delta: number): Promise<boolean>;
}

/** Everything reported about one item, for the moderation queue. */
export type ReportedItem = Readonly<{ targetType: ReportTarget; targetId: string; count: number; reasons: readonly ReportReason[]; notes: readonly string[]; firstAt: Date }>;

export interface ReportRepository {
  /** False when this person already has an open report on the item. */
  add(report: Report): Promise<boolean>;
  /** Items with open reports, most reported first. */
  openItems(limit: number): Promise<ReportedItem[]>;
  /** Closes every open report on an item. */
  /** `by` is the moderator, or null when the system closes them (the item was already gone). */
  resolve(targetType: ReportTarget, targetId: string, status: Exclude<ReportStatus, "open">, by: string | null, at: Date): Promise<number>;
}

/** Likes by people (one per person per target). */
export interface LikeRepository {
  /** True when this call changed anything (liking twice is a no-op). */
  set(accountId: string, targetType: LikeTarget, targetId: string, liked: boolean): Promise<boolean>;
  likedBy(accountId: string, targetType: LikeTarget, targetIds: readonly string[]): Promise<Set<string>>;
}
