import type { Conversation, Message, Side } from "./conversation";

export interface ConversationRepository {
  find(id: string): Promise<Conversation | null>;
  between(buyerId: string, sellerId: string): Promise<Conversation | null>;
  /** False when the pair already has one (two first messages raced). */
  create(conversation: Conversation): Promise<boolean>;
  save(conversation: Conversation): Promise<void>;
  markRead(id: string, side: Side, at: Date): Promise<void>;
  /** A shopper's conversations, or a shop's, latest first. */
  forBuyer(buyerId: string, limit: number): Promise<Conversation[]>;
  forSeller(sellerId: string, limit: number): Promise<Conversation[]>;
}

export interface MessageRepository {
  add(message: Message): Promise<void>;
  /** The latest `limit` messages, oldest first; or those after a time. */
  list(conversationId: string, opts: { limit: number; after?: Date }): Promise<Message[]>;
}
