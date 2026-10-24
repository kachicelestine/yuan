import { sql } from "drizzle-orm";
import { bigint, check, date, index, integer, numeric, pgSchema, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const affiliatesSchema = pgSchema("affiliates");

export const commissionStatus = affiliatesSchema.enum("commission_status", ["pending", "earned", "void"]);

export const creators = affiliatesSchema.table(
  "creators",
  {
    accountId: uuid().primaryKey(),
    code: text().notNull(),
    wallet: text(),
    createdAt: timestamp({ withTimezone: true }).notNull(),
  },
  (t) => [uniqueIndex("creators_code_uq").on(t.code)],
);

export const programs = affiliatesSchema.table(
  "programs",
  {
    sellerId: text().primaryKey(),
    rate: numeric({ precision: 4, scale: 3, mode: "number" }).notNull(),
    updatedAt: timestamp({ withTimezone: true }).notNull(),
  },
  (t) => [check("programs_rate", sql`${t.rate} between 0 and 0.3`)],
);

/** Clicks per creator, product and day: one row per combination, counted up. */
export const clicks = affiliatesSchema.table(
  "clicks",
  {
    code: text().notNull(),
    slug: text().notNull(),
    day: date({ mode: "string" }).notNull(),
    clicks: integer().notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.code, t.day, t.slug] })],
);

export const commissions = affiliatesSchema.table(
  "commissions",
  {
    id: uuid().primaryKey(),
    orderId: uuid().notNull(),
    sellerId: text().notNull(),
    creatorId: uuid().notNull(),
    code: text().notNull(),
    baseCents: bigint({ mode: "number" }).notNull(),
    rate: numeric({ precision: 4, scale: 3, mode: "number" }).notNull(),
    amountCents: bigint({ mode: "number" }).notNull(),
    slugs: text().array().notNull().default(sql`'{}'`),
    status: commissionStatus().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull(),
    settledAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    // One commission per shop per order, however often attribution runs.
    uniqueIndex("commissions_order_seller_uq").on(t.orderId, t.sellerId),
    index("commissions_creator_idx").on(t.creatorId, t.createdAt),
    index("commissions_seller_idx").on(t.sellerId, t.createdAt),
    check("commissions_amount", sql`${t.amountCents} > 0 and ${t.amountCents} <= ${t.baseCents}`),
  ],
);
