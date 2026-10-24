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
  type QuestionAsked,
} from "./application/interactions";
export { FEED_CANDIDATES, makeContentQueries, TOP_COMMENTS, type ContentQueries, type ContentQueryDeps } from "./application/queries";
export { ago, shortDate, type CommentView, type NoteView, type QuestionView, type ReviewView, type VideoView } from "./application/views";
export { askQuestion, summarise, writeComment, writeReview, type Comment, type LikeTarget, type Note, type PostError, type Question, type Review, type TargetType } from "./domain/posts";
export { EXPLORE_UNDER_VIEWS, engagements, rankFeed, score, type Candidate } from "./domain/ranking";
export type { CommentRepository, LikeRepository, NoteRepository, QuestionRepository, ReviewRepository, VideoRepository, VideoStats, WatchTally } from "./domain/repositories";
export {
  approve,
  draftVideo,
  encoded,
  fail,
  MAX_CAPTION,
  MAX_TAGGED,
  MAX_TAGS,
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
} from "./domain/video";
