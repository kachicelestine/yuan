import { and, asc, desc, eq, gt } from "drizzle-orm";
import type { Database } from "@/shared/infrastructure/database";
import type { Conversation, Message, Side } from "../domain/conversation";
import type { ConversationRepository, MessageRepository } from "../domain/repositories";
import { conversations, messages } from "./schema";

export class DrizzleConversationRepository implements ConversationRepository {
  constructor(private readonly db: Database) {}

  async find(id: string) {
    const [r] = await this.db.select().from(conversations).where(eq(conversations.id, id)).limit(1);
    return r ?? null;
  }

  async between(buyerId: string, sellerId: string) {
    const [r] = await this.db
      .select()
      .from(conversations)
      .where(and(eq(conversations.buyerId, buyerId), eq(conversations.sellerId, sellerId)))
      .limit(1);
    return r ?? null;
  }

  async create(c: Conversation) {
    const rows = await this.db.insert(conversations).values(c).onConflictDoNothing().returning({ id: conversations.id });
    return rows.length > 0;
  }

  async save(c: Conversation) {
    await this.db
      .update(conversations)
      .set({ lastAt: c.lastAt, lastText: c.lastText, lastFrom: c.lastFrom, buyerReadAt: c.buyerReadAt, shopReadAt: c.shopReadAt })
      .where(eq(conversations.id, c.id));
  }

  async markRead(id: string, side: Side, at: Date) {
    await this.db
      .update(conversations)
      .set(side === "buyer" ? { buyerReadAt: at } : { shopReadAt: at })
      .where(eq(conversations.id, id));
  }

  async forBuyer(buyerId: string, limit: number) {
    return this.db.select().from(conversations).where(eq(conversations.buyerId, buyerId)).orderBy(desc(conversations.lastAt)).limit(limit);
  }

  async forSeller(sellerId: string, limit: number) {
    return this.db.select().from(conversations).where(eq(conversations.sellerId, sellerId)).orderBy(desc(conversations.lastAt)).limit(limit);
  }
}

export class DrizzleMessageRepository implements MessageRepository {
  constructor(private readonly db: Database) {}

  async add(m: Message) {
    await this.db.insert(messages).values(m);
  }

  async list(conversationId: string, opts: { limit: number; after?: Date }) {
    if (opts.after) {
      return this.db
        .select()
        .from(messages)
        .where(and(eq(messages.conversationId, conversationId), gt(messages.at, opts.after)))
        .orderBy(asc(messages.at))
        .limit(opts.limit);
    }
    // The latest `limit`, shown oldest first.
    const latest = await this.db.select().from(messages).where(eq(messages.conversationId, conversationId)).orderBy(desc(messages.at)).limit(opts.limit);
    return latest.reverse();
  }
}
