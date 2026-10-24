// Public surface of the content context: shoppable videos, notes, comments, reviews and Q&A.
export {
  makeInteractions,
  type Actor,
  type CommentPosted,
  type InteractionDeps,
  type InteractionError,
  type Interactions,
  type InteractionScope,
  type ProductDirectory,
  type PurchaseDirectory,
  type ReviewPosted,
  type QuestionAnswered,
  type QuestionAsked,
} from "./application/interactions";
export { makeModeration, type ContentRemoved, type Moderation, type ModerationDeps, type ModerationError, type ModerationItemView, type ModerationScope, type PendingVideoView } from "./application/moderation";
export { REASON_LABELS, REPORT_REASONS, REPORT_TARGETS, fileReport, type Report, type ReportError, type ReportReason, type ReportStatus, type ReportTarget } from "./domain/moderation";
export { ENCODE_ATTEMPTS, ENCODE_LEASE_MS, makeUploads, type EncodeError, type MyVideoView, type UploadDeps, type UploadError, type Uploads, type VideoEncoder } from "./application/uploads";
export { FEED_CANDIDATES, makeContentQueries, TOP_COMMENTS, type ContentQueries, type ContentQueryDeps } from "./application/queries";
export { ago, shortDate, type CommentView, type NoteView, type QuestionView, type ReviewView, type VideoView } from "./application/views";
export { answerQuestion, askQuestion, summarise, writeComment, writeReview, type Comment, type LikeTarget, type Note, type PostError, type Question, type Review, type TargetType } from "./domain/posts";
export { EXPLORE_UNDER_VIEWS, engagements, rankFeed, score, type Candidate } from "./domain/ranking";
export type { CommentRepository, LikeRepository, NoteRepository, QuestionRepository, ReportedItem, ReportRepository, ReviewRepository, VideoRepository, VideoStats, WatchTally } from "./domain/repositories";
export {
  approve,
  draftVideo,
  encoded,
  fail,
  MAX_CAPTION,
  MAX_TAGGED,
  MAX_DURATION_MS,
  MAX_TAGS,
  MAX_UPLOAD_BYTES,
  remove,
  renditionFor,
  type Rendition,
  type Spot,
  type Video,
  type VideoEncoded,
  type VideoError,
  type VideoPublished,
  type VideoStatus,
  type VideoUploaded,
  UPLOAD_TYPES,
} from "./domain/video";
