import { index, pgSchema, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

export const messagingSchema = pgSchema("messaging");

export const side = messagingSchema.enum("side", ["buyer", "shop"]);

/** One conversation per shopper and shop. */
export const conversations = messagingSchema.table(
  "conversations",
  {
    id: uuid().primaryKey(),
    buyerId: uuid().notNull(),
    buyerName: text().notNull(),
    sellerId: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull(),
    lastAt: timestamp({ withTimezone: true }).notNull(),
    lastText: text().notNull(),
    lastFrom: side().notNull(),
    buyerReadAt: timestamp({ withTimezone: true }),
    shopReadAt: timestamp({ withTimezone: true }),
  },
  (t) => [uniqueIndex("conversations_pair_uq").on(t.buyerId, t.sellerId), index("conversations_buyer_idx").on(t.buyerId, t.lastAt), index("conversations_seller_idx").on(t.sellerId, t.lastAt)],
);

export const messages = messagingSchema.table(
  "messages",
  {
    id: uuid().primaryKey(),
    conversationId: uuid().notNull(),
    from: side().notNull(),
    authorId: uuid().notNull(),
    text: text().notNull(),
    productSlug: text(),
    at: timestamp({ withTimezone: true }).notNull(),
  },
  (t) => [index("messages_conversation_idx").on(t.conversationId, t.at)],
);
