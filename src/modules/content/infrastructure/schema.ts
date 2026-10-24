import { sql } from "drizzle-orm";
import { bigint, boolean, check, date, index, integer, jsonb, pgSchema, primaryKey, smallint, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { Rendition, Spot } from "../domain/video";

export const contentSchema = pgSchema("content");

export const videoStatus = contentSchema.enum("video_status", ["processing", "review", "ready", "failed", "removed"]);
export const targetType = contentSchema.enum("target_type", ["video", "note"]);
export const likeTarget = contentSchema.enum("like_target", ["video", "note", "comment", "question", "review"]);
export const tone = contentSchema.enum("tone", ["light", "dark"]);
export const noteRatio = contentSchema.enum("note_ratio", ["tall", "square", "wide"]);

export const videos = contentSchema.table(
  "videos",
  {
    id: text().primaryKey(),
    authorId: uuid(),
    sellerId: text().notNull(),
    productSlug: text().notNull(),
    alsoSlugs: text().array().notNull().default(sql`'{}'`),
    category: text().notNull(),
    spots: jsonb().$type<Spot[]>().notNull().default([]),
    posterUrl: text().notNull().default(""),
    renditions: jsonb().$type<Rendition[]>().notNull().default([]),
    sourceKey: text(),
    durationMs: integer(),
    tone: tone().notNull().default("dark"),
    caption: text().notNull(),
    tags: text().array().notNull().default(sql`'{}'`),
    place: text().notNull().default(""),
    status: videoStatus().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull(),
    publishedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    index("videos_ready_idx").on(t.publishedAt).where(sql`${t.status} = 'ready'`),
    index("videos_seller_idx").on(t.sellerId, t.publishedAt),
    index("videos_category_idx").on(t.category, t.publishedAt),
  ],
);

/** Hot counters live apart from the video row, so a like never rewrites the video. */
export const videoStats = contentSchema.table(
  "video_stats",
  {
    videoId: text()
      .primaryKey()
      .references(() => videos.id, { onDelete: "cascade" }),
    likes: integer().notNull().default(0),
    comments: integer().notNull().default(0),
    saves: integer().notNull().default(0),
    shares: integer().notNull().default(0),
    views: bigint({ mode: "number" }).notNull().default(0),
    watchMs: bigint({ mode: "number" }).notNull().default(0),
    completes: bigint({ mode: "number" }).notNull().default(0),
  },
  (t) => [check("video_stats_non_negative", sql`${t.likes} >= 0 and ${t.comments} >= 0 and ${t.saves} >= 0 and ${t.shares} >= 0 and ${t.views} >= 0`)],
);

/** Watching per video per day, for creator analytics and for ranking on recent engagement. */
export const videoDaily = contentSchema.table(
  "video_daily",
  {
    videoId: text()
      .notNull()
      .references(() => videos.id, { onDelete: "cascade" }),
    day: date({ mode: "string" }).notNull(),
    views: integer().notNull().default(0),
    watchMs: bigint({ mode: "number" }).notNull().default(0),
    completes: integer().notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.videoId, t.day] })],
);

export const comments = contentSchema.table(
  "comments",
  {
    id: text().primaryKey(),
    targetType: targetType().notNull(),
    targetId: text().notNull(),
    authorId: uuid(),
    authorName: text().notNull(),
    authorAvatar: text().notNull().default(""),
    text: text().notNull(),
    likes: integer().notNull().default(0),
    bySeller: boolean().notNull().default(false),
    createdAt: timestamp({ withTimezone: true }).notNull(),
  },
  (t) => [index("comments_target_idx").on(t.targetType, t.targetId, t.createdAt)],
);

export const notes = contentSchema.table(
  "notes",
  {
    id: text().primaryKey(),
    authorId: uuid(),
    authorName: text().notNull(),
    authorAvatar: text().notNull().default(""),
    title: text().notNull(),
    imageUrl: text().notNull(),
    ratio: noteRatio().notNull(),
    productSlug: text(),
    category: text().notNull(),
    live: boolean().notNull().default(false),
    video: boolean().notNull().default(false),
    likes: integer().notNull().default(0),
    createdAt: timestamp({ withTimezone: true }).notNull(),
  },
  (t) => [index("notes_category_idx").on(t.category, t.createdAt)],
);

export const reviews = contentSchema.table(
  "reviews",
  {
    id: text().primaryKey(),
    productSlug: text().notNull(),
    sellerId: text().notNull(),
    orderId: uuid(),
    authorId: uuid(),
    authorName: text().notNull(),
    authorAvatar: text().notNull().default(""),
    country: text().notNull(),
    rating: smallint().notNull(),
    text: text().notNull(),
    translatedFrom: text(),
    original: text(),
    photos: text().array().notNull().default(sql`'{}'`),
    option: text(),
    helpful: integer().notNull().default(0),
    sellerReply: text(),
    createdAt: timestamp({ withTimezone: true }).notNull(),
  },
  (t) => [
    index("reviews_product_idx").on(t.productSlug, t.createdAt),
    index("reviews_seller_idx").on(t.sellerId, t.createdAt),
    // One review per product per order.
    uniqueIndex("reviews_order_idx").on(t.orderId, t.productSlug),
    check("reviews_rating", sql`${t.rating} between 1 and 5`),
  ],
);

export const questions = contentSchema.table(
  "questions",
  {
    id: text().primaryKey(),
    productSlug: text().notNull(),
    askerId: uuid(),
    askerName: text().notNull(),
    question: text().notNull(),
    answer: text(),
    answeredBy: text(),
    votes: integer().notNull().default(0),
    createdAt: timestamp({ withTimezone: true }).notNull(),
  },
  (t) => [index("questions_product_idx").on(t.productSlug, t.createdAt)],
);

export const likes = contentSchema.table(
  "likes",
  {
    accountId: uuid().notNull(),
    targetType: likeTarget().notNull(),
    targetId: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.accountId, t.targetType, t.targetId] })],
);
