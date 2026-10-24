import { sql } from "drizzle-orm";
import { boolean, index, integer, jsonb, pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type { HoldSource } from "../domain/hold";
import type { ShowItem } from "../domain/show";

export const liveSchema = pgSchema("live");

export const showKind = liveSchema.enum("show_kind", ["show", "tour", "auction"]);
export const showStatus = liveSchema.enum("show_status", ["scheduled", "live", "ended"]);
export const lotStatus = liveSchema.enum("lot_status", ["open", "sold", "unsold"]);

/** Stored item: money in cents. */
export type StoredItem = Omit<ShowItem, "livePrice"> & { livePriceCents: number | null };

export const shows = liveSchema.table(
  "shows",
  {
    // Text, so seeded rooms keep readable addresses (/live/glowlab); new shows use UUIDs.
    id: text().primaryKey(),
    sellerId: text().notNull(),
    hostAccountId: uuid().notNull(),
    hostName: text().notNull(),
    title: text().notNull(),
    kind: showKind().notNull(),
    coverUrl: text().notNull(),
    place: text().notNull().default(""),
    status: showStatus().notNull(),
    scheduledFor: timestamp({ withTimezone: true }).notNull(),
    startedAt: timestamp({ withTimezone: true }),
    endedAt: timestamp({ withTimezone: true }),
    streamKey: text().notNull(),
    items: jsonb().$type<StoredItem[]>().notNull().default([]),
    pinned: jsonb().$type<{ q: string; a: string } | null>(),
    peakViewers: integer().notNull().default(0),
  },
  (t) => [index("shows_status_idx").on(t.status, t.scheduledFor), index("shows_seller_idx").on(t.sellerId, t.scheduledFor)],
);

export const chatMessages = liveSchema.table(
  "chat_messages",
  {
    id: uuid().primaryKey(),
    showId: text().notNull(),
    authorId: uuid().notNull(),
    authorName: text().notNull(),
    text: text().notNull(),
    host: boolean().notNull().default(false),
    at: timestamp({ withTimezone: true }).notNull(),
  },
  (t) => [index("chat_show_idx").on(t.showId, t.at)],
);

export const lots = liveSchema.table(
  "lots",
  {
    id: uuid().primaryKey(),
    showId: text().notNull(),
    slug: text().notNull(),
    startPriceCents: integer().notNull(),
    incrementCents: integer().notNull(),
    endsAt: timestamp({ withTimezone: true }).notNull(),
    status: lotStatus().notNull(),
    topBid: jsonb().$type<{ amountCents: number; bidderId: string; bidderName: string; at: string } | null>(),
    bids: integer().notNull().default(0),
    version: integer().notNull().default(0),
  },
  (t) => [index("lots_show_idx").on(t.showId), index("lots_due_idx").on(t.endsAt).where(sql`${t.status} = 'open'`)],
);

export const holds = liveSchema.table(
  "holds",
  {
    id: uuid().primaryKey(),
    accountId: uuid().notNull(),
    slug: text().notNull(),
    priceCents: integer().notNull(),
    qty: integer().notNull(),
    source: jsonb().$type<HoldSource>().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    usedAt: timestamp({ withTimezone: true }),
    createdAt: timestamp({ withTimezone: true }).notNull(),
  },
  (t) => [index("holds_account_idx").on(t.accountId, t.slug)],
);
