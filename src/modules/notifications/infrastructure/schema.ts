import { sql } from "drizzle-orm";
import { index, pgSchema, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const notificationsSchema = pgSchema("notifications");

export const notifications = notificationsSchema.table(
  "notifications",
  {
    id: uuid().primaryKey(),
    accountId: uuid().notNull(),
    kind: text().notNull(),
    title: text().notNull(),
    body: text().notNull(),
    link: text(),
    key: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull(),
    readAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    uniqueIndex("notifications_once_uq").on(t.accountId, t.key),
    index("notifications_account_idx").on(t.accountId, t.createdAt),
    index("notifications_unread_idx").on(t.accountId).where(sql`${t.readAt} is null`),
  ],
);
