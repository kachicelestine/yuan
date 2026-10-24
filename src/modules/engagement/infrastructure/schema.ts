import { sql } from "drizzle-orm";
import { boolean, check, index, integer, numeric, pgSchema, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const engagementSchema = pgSchema("engagement");

export const couponKind = engagementSchema.enum("coupon_kind", ["amount", "percent", "free_shipping"]);
export const listKind = engagementSchema.enum("list_kind", ["saved", "alert"]);
export const coinReason = engagementSchema.enum("coin_reason", ["checkin", "reward", "adjustment"]);

export const coupons = engagementSchema.table(
  "coupons",
  {
    id: text().primaryKey(),
    kind: couponKind().notNull(),
    /** Cents for amount coupons, a fraction for percent coupons. */
    value: numeric({ precision: 12, scale: 4, mode: "number" }).notNull(),
    minSpendCents: integer().notNull(),
    sellerId: text(),
    title: text().notNull(),
    detail: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
  },
  (t) => [check("coupons_value", sql`${t.value} >= 0`)],
);

export const couponClaims = engagementSchema.table(
  "coupon_claims",
  {
    accountId: uuid().notNull(),
    couponId: text()
      .notNull()
      .references(() => coupons.id),
    claimedAt: timestamp({ withTimezone: true }).notNull(),
    /** The order this coupon is reserved for, until it's paid or lapses. */
    orderId: uuid(),
    redeemedAt: timestamp({ withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.accountId, t.couponId] }), index("coupon_claims_order_idx").on(t.orderId)],
);

export const listItems = engagementSchema.table(
  "list_items",
  {
    accountId: uuid().notNull(),
    kind: listKind().notNull(),
    slug: text().notNull(),
    position: integer().notNull(),
  },
  (t) => [primaryKey({ columns: [t.accountId, t.kind, t.slug] })],
);

export const watches = engagementSchema.table(
  "watches",
  {
    accountId: uuid().notNull(),
    slug: text().notNull(),
    targetCents: integer().notNull(),
    autoBuy: boolean().notNull().default(false),
  },
  (t) => [primaryKey({ columns: [t.accountId, t.slug] }), check("watches_target", sql`${t.targetCents} > 0`)],
);

/** What coins can buy. */
export const rewards = engagementSchema.table(
  "rewards",
  {
    id: text().primaryKey(),
    title: text().notNull(),
    cost: integer().notNull(),
    couponId: text()
      .notNull()
      .references(() => coupons.id),
  },
  (t) => [check("rewards_cost", sql`${t.cost} > 0`)],
);

/** The running balance; the check keeps it from going below zero under any race. */
export const coinBalances = engagementSchema.table(
  "coin_balances",
  {
    accountId: uuid().primaryKey(),
    balance: integer().notNull(),
  },
  (t) => [check("coin_balances_balance", sql`${t.balance} >= 0`)],
);

/** Every coin movement. Unique per (account, reason, ref) so retries can't pay twice. */
export const coinEntries = engagementSchema.table(
  "coin_entries",
  {
    id: uuid().primaryKey(),
    accountId: uuid().notNull(),
    amount: integer().notNull(),
    reason: coinReason().notNull(),
    ref: text().notNull(),
    at: timestamp({ withTimezone: true }).notNull(),
  },
  (t) => [uniqueIndex("coin_entries_once").on(t.accountId, t.reason, t.ref), index("coin_entries_account_idx").on(t.accountId, t.at)],
);
