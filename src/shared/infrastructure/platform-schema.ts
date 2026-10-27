import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgSchema, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

/** Tables that serve every context rather than belonging to one: delivery, scheduling, limits. */
export const platformSchema = pgSchema("platform");

/**
 * Domain events written in the same transaction as the change that caused them, then
 * delivered by the dispatcher. Rows stay after delivery for a while, for debugging.
 */
export const outbox = platformSchema.table(
  "outbox",
  {
    id: uuid().primaryKey(),
    topic: text().notNull(),
    /** The aggregate the event is about, e.g. an order id. */
    key: text().notNull(),
    payload: jsonb().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull(),
    /** Not before this time (retries back off by moving it forward). */
    availableAt: timestamp({ withTimezone: true }).notNull(),
    attempts: integer().notNull().default(0),
    /** A dispatcher holds the row until then; a crash just lets the lease run out. */
    lockedUntil: timestamp({ withTimezone: true }),
    processedAt: timestamp({ withTimezone: true }),
    /** Set when retries are exhausted; the row is kept for a person to look at. */
    failedAt: timestamp({ withTimezone: true }),
    lastError: text(),
  },
  (t) => [index("outbox_pending_idx").on(t.availableAt).where(sql`${t.processedAt} is null and ${t.failedAt} is null`)],
);

/** Recurring jobs. Claiming a due row is one conditional UPDATE, so only one instance runs each tick. */
export const schedules = platformSchema.table("schedules", {
  name: text().primaryKey(),
  nextRunAt: timestamp({ withTimezone: true }).notNull(),
  lockedUntil: timestamp({ withTimezone: true }),
  lastRunAt: timestamp({ withTimezone: true }),
  lastError: text(),
});

/** Every admin decision: who did what to which thing, and why. Rows are never edited. */
export const adminActions = platformSchema.table(
  "admin_actions",
  {
    id: uuid().primaryKey(),
    adminId: uuid().notNull(),
    /** e.g. "account.suspend", "listing.remove", "parcel.refund". */
    action: text().notNull(),
    targetType: text().notNull(),
    targetId: text().notNull(),
    note: text(),
    at: timestamp({ withTimezone: true }).notNull(),
  },
  (t) => [index("admin_actions_at_idx").on(t.at), index("admin_actions_target_idx").on(t.targetType, t.targetId)],
);

/** Fixed-window counters, shared by every app instance. */
export const rateLimits = platformSchema.table(
  "rate_limits",
  {
    key: text().notNull(),
    windowStart: timestamp({ withTimezone: true }).notNull(),
    count: integer().notNull(),
  },
  (t) => [primaryKey({ columns: [t.key, t.windowStart] })],
);
