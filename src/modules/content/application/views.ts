import type { Comment, Note, Question, Review } from "../domain/posts";
import type { VideoStats } from "../domain/repositories";
import { renditionFor, type Rendition, type Spot, type Video } from "../domain/video";

// What the UI receives. Shapes match what the screens were designed against, so pages can
// move from fixtures to the database without the components changing.

export type CommentView = {
  id: string;
  name: string;
  avatar: string;
  text: string;
  likes: number;
  /** "now", "5m", "2h", "3d", "6w". */
  ago: string;
  /** When it was posted (ISO), for paging back through a thread. */
  at: string;
  /** Written by the seller of the product in the video. */
  seller?: boolean;
};

export type VideoView = {
  id: string;
  sellerId: string;
  productSlug: string;
  /** More products tagged in the same video (shop the look). */
  also?: string[];
  /** The clip phones play first (720p or the closest below it). */
  clip?: string;
  /** Every encoded size, smallest first, for players that pick by screen and connection. */
  renditions: Rendition[];
  spots?: Spot[];
  image: string;
  tone: "light" | "dark";
  caption: string;
  tags: string[];
  place: string;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  views: number;
  topComments: CommentView[];
};

export type NoteView = {
  id: string;
  title: string;
  image: string;
  ratio: "tall" | "square" | "wide";
  authorName: string;
  authorAvatar: string;
  likes: number;
  productSlug?: string;
  live?: boolean;
  video?: boolean;
  category: string;
};

export type ReviewView = {
  id: string;
  productSlug: string;
  author: string;
  avatar: string;
  country: string;
  rating: number;
  text: string;
  translatedFrom?: string;
  original?: string;
  photos?: string[];
  option?: string;
  /** "Oct 12". */
  date: string;
  helpful: number;
  sellerReply?: string;
  /** Tied to an order on this platform. */
  verified: boolean;
};

export type QuestionView = {
  id: string;
  productSlug: string;
  question: string;
  /** Null until someone answers. */
  answer: string | null;
  answeredBy: "seller" | "buyer" | null;
  asker: string;
  votes: number;
};

const NO_STATS: VideoStats = { likes: 0, comments: 0, saves: 0, shares: 0, views: 0 };
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Compact age, the way comment threads show it. */
export function ago(at: Date, now: Date) {
  const minutes = Math.floor((now.getTime() - at.getTime()) / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return `${Math.floor(days / 7)}w`;
}

/** "Oct 12" (UTC, so every server renders the same text). */
export const shortDate = (at: Date) => `${MONTHS[at.getUTCMonth()]} ${at.getUTCDate()}`;

/** Phones get 720p; bigger renditions are for players that ask for them. */
const PHONE_HEIGHT = 720;

export function toCommentView(c: Comment, now: Date): CommentView {
  return { id: c.id, name: c.authorName, avatar: c.authorAvatar, text: c.text, likes: c.likes, ago: ago(c.createdAt, now), at: c.createdAt.toISOString(), ...(c.bySeller && { seller: true }) };
}

export function toVideoView(v: Video, stats: VideoStats | undefined, topComments: readonly Comment[], now: Date): VideoView {
  const s = stats ?? NO_STATS;
  const renditions = [...v.renditions];
  return {
    id: v.id,
    sellerId: v.sellerId,
    productSlug: v.productSlug,
    ...(v.alsoSlugs.length > 0 && { also: [...v.alsoSlugs] }),
    ...(renditions.length > 0 && { clip: renditionFor(renditions, PHONE_HEIGHT)!.url }),
    renditions,
    ...(v.spots.length > 0 && { spots: [...v.spots] }),
    image: v.posterUrl,
    tone: v.tone,
    caption: v.caption,
    tags: [...v.tags],
    place: v.place,
    likes: s.likes,
    comments: s.comments,
    saves: s.saves,
    shares: s.shares,
    views: s.views,
    topComments: topComments.map((c) => toCommentView(c, now)),
  };
}

export function toNoteView(n: Note): NoteView {
  return {
    id: n.id,
    title: n.title,
    image: n.imageUrl,
    ratio: n.ratio,
    authorName: n.authorName,
    authorAvatar: n.authorAvatar,
    likes: n.likes,
    ...(n.productSlug !== null && { productSlug: n.productSlug }),
    ...(n.live && { live: true }),
    ...(n.video && { video: true }),
    category: n.category,
  };
}

export function toReviewView(r: Review): ReviewView {
  return {
    id: r.id,
    productSlug: r.productSlug,
    author: r.authorName,
    avatar: r.authorAvatar,
    country: r.country,
    rating: r.rating,
    text: r.text,
    ...(r.translatedFrom !== null && { translatedFrom: r.translatedFrom }),
    ...(r.original !== null && { original: r.original }),
    ...(r.photos.length > 0 && { photos: [...r.photos] }),
    ...(r.option !== null && { option: r.option }),
    date: shortDate(r.createdAt),
    helpful: r.helpful,
    ...(r.sellerReply !== null && { sellerReply: r.sellerReply }),
    verified: r.orderId !== null,
  };
}

export function toQuestionView(q: Question): QuestionView {
  return { id: q.id, productSlug: q.productSlug, question: q.question, answer: q.answer, answeredBy: q.answeredBy, asker: q.askerName, votes: q.votes };
}
