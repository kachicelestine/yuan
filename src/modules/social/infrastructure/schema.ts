import { sql } from "drizzle-orm";
import { check, index, pgSchema, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const socialSchema = pgSchema("social");

/** One public profile per account. */
export const profiles = socialSchema.table(
  "profiles",
  {
    accountId: uuid().primaryKey(),
    handle: text().notNull(),
    name: text().notNull(),
    bio: text().notNull().default(""),
    avatar: text().notNull().default(""),
    createdAt: timestamp({ withTimezone: true }).notNull(),
    updatedAt: timestamp({ withTimezone: true }).notNull(),
  },
  (t) => [uniqueIndex("profiles_handle_idx").on(t.handle), check("profiles_handle", sql`${t.handle} ~ '^[a-z0-9_][a-z0-9_.]{1,22}[a-z0-9_]$'`)],
);

/** Who follows whom. */
export const follows = socialSchema.table(
  "follows",
  {
    followerId: uuid().notNull(),
    followeeId: uuid().notNull(),
    at: timestamp({ withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.followerId, t.followeeId] }), index("follows_followee_idx").on(t.followeeId, t.at), check("follows_not_self", sql`${t.followerId} <> ${t.followeeId}`)],
);
