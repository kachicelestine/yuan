import { sql } from "drizzle-orm";
import { check, index, integer, pgSchema, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const identitySchema = pgSchema("identity");

export const accounts = identitySchema.table(
  "accounts",
  {
    id: uuid().primaryKey(),
    email: text(),
    wallet: text(),
    createdAt: timestamp({ withTimezone: true }).notNull(),
  },
  (t) => [
    uniqueIndex("accounts_email_uq").on(t.email),
    // Wallet addresses compare case-insensitively (checksums only change letter case).
    uniqueIndex("accounts_wallet_uq").on(sql`lower(${t.wallet})`),
    check("accounts_has_login", sql`${t.email} is not null or ${t.wallet} is not null`),
  ],
);

export const emailChallenges = identitySchema.table(
  "email_challenges",
  {
    id: uuid().primaryKey(),
    email: text().notNull(),
    codeHash: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    attempts: integer().notNull().default(0),
    consumedAt: timestamp({ withTimezone: true }),
  },
  (t) => [index("email_challenges_email_idx").on(t.email, t.createdAt)],
);

export const walletChallenges = identitySchema.table("wallet_challenges", {
  nonce: text().primaryKey(),
  address: text().notNull(),
  message: text().notNull(),
  expiresAt: timestamp({ withTimezone: true }).notNull(),
  consumedAt: timestamp({ withTimezone: true }),
});

export const sessions = identitySchema.table(
  "sessions",
  {
    id: uuid().primaryKey(),
    /** SHA-256 of the browser's token; the token itself is never stored. */
    tokenHash: text().notNull().unique(),
    accountId: uuid()
      .notNull()
      .references(() => accounts.id, { onDelete: "cascade" }),
    createdAt: timestamp({ withTimezone: true }).notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
  },
  (t) => [index("sessions_account_idx").on(t.accountId)],
);
