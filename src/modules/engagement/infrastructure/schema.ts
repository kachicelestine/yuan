import { sql } from "drizzle-orm";
import { boolean, check, index, integer, numeric, pgSchema, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const engagementSchema = pgSchema("engagement");

export const couponKind = engagementSchema.enum("coupon_kind", ["amount", "percent", "free_shipping"]);
export const listKind = engagementSchema.enum("list_kind", ["saved", "alert"]);
export const coinReason = engagementSchema.enum("coin_reason", ["checkin", "reward", "adjustment", "mission"]);

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
    /** When it was added, for "most saved this week". */
    addedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.accountId, t.kind, t.slug] }), index("list_items_added_idx").on(t.kind, t.addedAt)],
);

export const watches = engagementSchema.table(
  "watches",
  {
    accountId: uuid().notNull(),
    slug: text().notNull(),
    targetCents: integer().notNull(),
    autoBuy: boolean().notNull().default(false),
    /** The price we last told them about, so a price that stays low alerts once. */
    notifiedCents: integer(),
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

/** "This or that?" polls; ids are short codes for share links. */
export const polls = engagementSchema.table(
  "polls",
  {
    id: text().primaryKey(),
    authorId: uuid().notNull(),
    authorName: text().notNull(),
    question: text().notNull(),
    slugs: text().array().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull(),
    endsAt: timestamp({ withTimezone: true }).notNull(),
  },
  (t) => [index("polls_author_idx").on(t.authorId, t.createdAt)],
);

/** One vote per voter per poll (an account id, or an anonymous browser id). */
export const pollVotes = engagementSchema.table(
  "poll_votes",
  {
    pollId: text().notNull(),
    voter: text().notNull(),
    name: text().notNull(),
    choice: integer().notNull(),
    reason: text(),
    at: timestamp({ withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.pollId, t.voter] }), check("poll_votes_choice", sql`${t.choice} between 0 and 2`)],
);

export const chopStatus = engagementSchema.enum("chop_status", ["open", "done", "expired", "used"]);

/** A shop's offer: this listing can be chopped to a target by N friends, up to `remaining` times. */
export const chopOffers = engagementSchema.table(
  "chop_offers",
  {
    id: uuid().primaryKey(),
    sellerId: text().notNull(),
    slug: text().notNull(),
    fullPriceCents: integer().notNull(),
    targetCents: integer().notNull(),
    cuts: integer().notNull(),
    hours: integer().notNull(),
    remaining: integer().notNull(),
    active: boolean().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull(),
  },
  (t) => [
    index("chop_offers_seller_idx").on(t.sellerId, t.createdAt),
    check("chop_offers_remaining", sql`${t.remaining} >= 0`),
    check("chop_offers_target", sql`${t.targetCents} > 0 and ${t.targetCents} < ${t.fullPriceCents}`),
  ],
);

export const chops = engagementSchema.table(
  "chops",
  {
    id: text().primaryKey(),
    offerId: uuid().notNull(),
    ownerId: uuid().notNull(),
    ownerName: text().notNull(),
    slug: text().notNull(),
    fullPriceCents: integer().notNull(),
    targetCents: integer().notNull(),
    cuts: integer().notNull(),
    startedAt: timestamp({ withTimezone: true }).notNull(),
    endsAt: timestamp({ withTimezone: true }).notNull(),
    status: chopStatus().notNull(),
    doneAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    index("chops_owner_idx").on(t.ownerId, t.startedAt),
    index("chops_open_idx").on(t.endsAt).where(sql`${t.status} = 'open'`),
    index("chops_offer_idx").on(t.offerId),
  ],
);

/** One cut per person per chop (an account id, or an anonymous browser id). */
export const chopCuts = engagementSchema.table(
  "chop_cuts",
  {
    chopId: text().notNull(),
    cutter: text().notNull(),
    name: text().notNull(),
    at: timestamp({ withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.chopId, t.cutter] }), index("chop_cuts_cutter_idx").on(t.cutter, t.at)],
);

export const dropKind = engagementSchema.enum("drop_kind", ["drop", "restock"]);

/** A shop's scheduled drop (a price and stock for a while) or restock. */
export const drops = engagementSchema.table(
  "drops",
  {
    id: uuid().primaryKey(),
    sellerId: text().notNull(),
    slug: text().notNull(),
    kind: dropKind().notNull(),
    title: text().notNull(),
    blurb: text().notNull(),
    startsAt: timestamp({ withTimezone: true }).notNull(),
    endsAt: timestamp({ withTimezone: true }).notNull(),
    priceCents: integer(),
    stock: integer(),
    perPerson: integer().notNull(),
    claimed: integer().notNull().default(0),
    cancelled: boolean().notNull().default(false),
    createdAt: timestamp({ withTimezone: true }).notNull(),
  },
  (t) => [
    index("drops_window_idx").on(t.endsAt, t.startsAt),
    index("drops_seller_idx").on(t.sellerId, t.startsAt),
    check("drops_claimed", sql`${t.claimed} >= 0 and (${t.stock} is null or ${t.claimed} <= ${t.stock})`),
  ],
);

export const promoSource = engagementSchema.enum("promo_source", ["drop", "team"]);

/** Prices someone may check out at for a while: drop claims and full teams. */
export const promoHolds = engagementSchema.table(
  "promo_holds",
  {
    id: uuid().primaryKey(),
    accountId: uuid().notNull(),
    slug: text().notNull(),
    priceCents: integer().notNull(),
    qty: integer().notNull(),
    source: promoSource().notNull(),
    sourceId: text().notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    usedAt: timestamp({ withTimezone: true }),
    /** A lapsed hold that was handled (its stock given back). */
    retiredAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    index("promo_holds_account_idx").on(t.accountId, t.slug),
    index("promo_holds_source_idx").on(t.source, t.sourceId, t.accountId),
    index("promo_holds_lapse_idx").on(t.expiresAt).where(sql`${t.usedAt} is null and ${t.retiredAt} is null`),
  ],
);

export const teamOffers = engagementSchema.table(
  "team_offers",
  {
    id: uuid().primaryKey(),
    sellerId: text().notNull(),
    slug: text().notNull(),
    fullPriceCents: integer().notNull(),
    teamPriceCents: integer().notNull(),
    size: integer().notNull(),
    hours: integer().notNull(),
    remaining: integer().notNull(),
    active: boolean().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull(),
  },
  (t) => [index("team_offers_seller_idx").on(t.sellerId, t.createdAt), check("team_offers_remaining", sql`${t.remaining} >= 0`)],
);

export const teamStatus = engagementSchema.enum("team_status", ["open", "full", "expired"]);

export const teams = engagementSchema.table(
  "teams",
  {
    id: text().primaryKey(),
    offerId: uuid().notNull(),
    slug: text().notNull(),
    leaderId: uuid().notNull(),
    leaderName: text().notNull(),
    teamPriceCents: integer().notNull(),
    size: integer().notNull(),
    startedAt: timestamp({ withTimezone: true }).notNull(),
    endsAt: timestamp({ withTimezone: true }).notNull(),
    status: teamStatus().notNull(),
    fullAt: timestamp({ withTimezone: true }),
  },
  (t) => [index("teams_open_idx").on(t.offerId, t.endsAt).where(sql`${t.status} = 'open'`)],
);

export const teamMembers = engagementSchema.table(
  "team_members",
  {
    teamId: text().notNull(),
    accountId: uuid().notNull(),
    name: text().notNull(),
    at: timestamp({ withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.teamId, t.accountId] }), index("team_members_account_idx").on(t.accountId)],
);

/** "Remind me": one per person per thing (a drop, a festival), sent once before it starts. */
export const reminders = engagementSchema.table(
  "reminders",
  {
    key: text().notNull(),
    accountId: uuid().notNull(),
    at: timestamp({ withTimezone: true }).notNull(),
    title: text().notNull(),
    link: text().notNull(),
    sentAt: timestamp({ withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.key, t.accountId] }), index("reminders_due_idx").on(t.at).where(sql`${t.sentAt} is null`)],
);
