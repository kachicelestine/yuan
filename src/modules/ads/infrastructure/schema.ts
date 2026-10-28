import { sql } from "drizzle-orm";
import { bigint, check, date, index, integer, pgSchema, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const adsSchema = pgSchema("ads");

export const campaignStatus = adsSchema.enum("campaign_status", ["active", "paused"]);

export const campaigns = adsSchema.table(
  "campaigns",
  {
    id: uuid().primaryKey(),
    sellerId: text().notNull(),
    name: text().notNull(),
    slugs: text().array().notNull(),
    bidCents: integer().notNull(),
    dailyBudgetCents: integer().notNull(),
    status: campaignStatus().notNull(),
    /** Set for a video boost: the video shown as a sponsored slide. */
    videoId: text(),
    createdAt: timestamp({ withTimezone: true }).notNull(),
    updatedAt: timestamp({ withTimezone: true }).notNull(),
  },
  (t) => [
    index("campaigns_seller_idx").on(t.sellerId, t.createdAt),
    index("campaigns_active_idx").on(t.status).where(sql`${t.status} = 'active'`),
    check("campaigns_bid", sql`${t.bidCents} between 5 and 500`),
    check("campaigns_budget", sql`${t.dailyBudgetCents} between 100 and 100000`),
  ],
);

/** Impressions, clicks and spend per campaign per day (UTC). */
export const daily = adsSchema.table(
  "daily",
  {
    campaignId: uuid().notNull(),
    day: date({ mode: "string" }).notNull(),
    impressions: integer().notNull().default(0),
    clicks: integer().notNull().default(0),
    spendCents: bigint({ mode: "number" }).notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.campaignId, t.day] })],
);
