import { domainError, err, ok, type DomainError, type Result } from "@/shared/kernel";

/** What a comment is attached to. */
export type TargetType = "video" | "note";
/** What a like (or a "useful" vote) is attached to. One per person per target. */
export type LikeTarget = TargetType | "comment" | "question" | "review";

export type Comment = Readonly<{
  id: string;
  targetType: TargetType;
  targetId: string;
  /** Null for comments loaded from seed data. */
  authorId: string | null;
  authorName: string;
  authorAvatar: string;
  text: string;
  likes: number;
  /** Written by the seller whose product the video shows. */
  bySeller: boolean;
  createdAt: Date;
}>;

/** A Discover note: an experience-first post that can link a product. */
export type Note = Readonly<{
  id: string;
  authorId: string | null;
  authorName: string;
  authorAvatar: string;
  title: string;
  imageUrl: string;
  /** Height hint in the waterfall. */
  ratio: "tall" | "square" | "wide";
  productSlug: string | null;
  category: string;
  live: boolean;
  video: boolean;
  likes: number;
  /** Hashtags, normalised like videos': lower case, no "#". */
  tags: readonly string[];
  createdAt: Date;
}>;

export const MAX_NOTE_CAPTION = 300;
export const MAX_NOTE_TAGS = 10;
export type NoteError = DomainError<"invalid_caption" | "too_many_tags" | "invalid_photo">;

/** Normalises hashtags: trims, drops "#", lower case, no repeats, letters and numbers only. */
export function cleanTags(tags: readonly string[]): string[] {
  return [...new Set(tags.map((t) => t.trim().replace(/^#+/, "").toLowerCase().replace(/[^\p{L}\p{N}_]/gu, "")).filter((t) => t.length > 0 && t.length <= 40))];
}

/** A photo post someone made: their photo, a caption, and optionally a product it shows. */
export function draftNote(props: {
  id: string;
  author: { accountId: string; name: string; avatar: string };
  imageUrl: string;
  ratio: Note["ratio"];
  productSlug: string | null;
  category: string;
  caption: string;
  tags: readonly string[];
  at: Date;
}): Result<Note, NoteError> {
  const title = props.caption.trim();
  if (!title.length || title.length > MAX_NOTE_CAPTION) return err(domainError("invalid_caption", `Write a caption of up to ${MAX_NOTE_CAPTION} characters.`));
  const tags = cleanTags([...props.tags, ...(title.match(/#[\p{L}\p{N}_]+/gu) ?? [])]);
  if (tags.length > MAX_NOTE_TAGS) return err(domainError("too_many_tags", `Use up to ${MAX_NOTE_TAGS} tags.`));
  if (!props.imageUrl.startsWith(`/media/notes/${props.author.accountId}/`)) return err(domainError("invalid_photo", "Upload a photo first."));
  return ok({
    id: props.id,
    authorId: props.author.accountId,
    authorName: props.author.name,
    authorAvatar: props.author.avatar,
    title,
    imageUrl: props.imageUrl,
    ratio: props.ratio,
    productSlug: props.productSlug,
    category: props.category,
    live: false,
    video: false,
    likes: 0,
    tags,
    createdAt: props.at,
  });
}

export type Review = Readonly<{
  id: string;
  productSlug: string;
  sellerId: string;
  /** The order that proves the purchase; null for seed reviews. */
  orderId: string | null;
  authorId: string | null;
  authorName: string;
  authorAvatar: string;
  country: string;
  rating: number;
  text: string;
  /** Set when `text` is a machine translation of `original`. */
  translatedFrom: string | null;
  original: string | null;
  photos: readonly string[];
  option: string | null;
  helpful: number;
  sellerReply: string | null;
  createdAt: Date;
}>;

export type Question = Readonly<{
  id: string;
  productSlug: string;
  /** The shop that answers; null for seed questions. */
  sellerId: string | null;
  askerId: string | null;
  askerName: string;
  question: string;
  answer: string | null;
  answeredBy: "seller" | "buyer" | null;
  votes: number;
  createdAt: Date;
}>;

export type PostError = DomainError<"invalid_text" | "invalid_rating" | "already_answered">;

const clean = (text: string) => text.replace(/\s+/g, " ").trim();

export function writeComment(props: Omit<Comment, "likes" | "text"> & { text: string }): Result<Comment, PostError> {
  const text = clean(props.text);
  if (!text || text.length > 500) return err(domainError("invalid_text", "Comments are 1 to 500 characters."));
  return ok({ ...props, text, likes: 0 });
}

export function writeReview(props: Omit<Review, "helpful" | "sellerReply" | "translatedFrom" | "original" | "text"> & { text: string }): Result<Review, PostError> {
  const text = props.text.trim();
  if (!Number.isInteger(props.rating) || props.rating < 1 || props.rating > 5) return err(domainError("invalid_rating", "Pick 1 to 5 stars."));
  if (text.length < 10 || text.length > 2000) return err(domainError("invalid_text", "Reviews are 10 to 2,000 characters."));
  return ok({ ...props, text, photos: props.photos.slice(0, 6), helpful: 0, sellerReply: null, translatedFrom: null, original: null });
}

export function askQuestion(props: Omit<Question, "answer" | "answeredBy" | "votes" | "question"> & { question: string }): Result<Question, PostError> {
  const question = clean(props.question);
  if (question.length < 5 || question.length > 300) return err(domainError("invalid_text", "Questions are 5 to 300 characters."));
  return ok({ ...props, question, answer: null, answeredBy: null, votes: 0 });
}

/** The shop's answer. Answers are final: a correction is a new answer in the thread later. */
export function answerQuestion(q: Question, text: string): Result<Question, PostError> {
  if (q.answer) return err(domainError("already_answered", "This question already has an answer."));
  const answer = text.trim();
  if (answer.length < 2 || answer.length > 1000) return err(domainError("invalid_text", "Answers are 2 to 1,000 characters."));
  return ok({ ...q, answer, answeredBy: "seller" });
}

/** Star counts (5★ first) and the average, from individual ratings. */
export function summarise(ratings: readonly number[]) {
  const stars = [5, 4, 3, 2, 1].map((s) => ratings.filter((r) => r === s).length);
  const average = ratings.length ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10 : 0;
  return { count: ratings.length, average, stars };
}
