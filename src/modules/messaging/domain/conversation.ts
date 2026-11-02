import { domainError, err, ok, type DomainError, type Result } from "@/shared/kernel";

// Shoppers and shops talk in one conversation per pair. Either side can write; a message
// may carry a product card or a photo (a private file only the two sides can see). Each side has its own read mark, so both see what's new.
// Payment never happens in chat: the thread says so, and links only to listings.

export const MAX_MESSAGE = 2000;

export type Side = "buyer" | "shop";

export type Conversation = Readonly<{
  id: string;
  buyerId: string;
  buyerName: string;
  sellerId: string;
  createdAt: Date;
  lastAt: Date;
  lastText: string;
  lastFrom: Side;
  buyerReadAt: Date | null;
  shopReadAt: Date | null;
}>;

export type Message = Readonly<{
  id: string;
  conversationId: string;
  from: Side;
  /** Who wrote it (for shops, which member). */
  authorId: string;
  text: string;
  productSlug: string | null;
  /** Storage key of a photo, in private storage. */
  photo: string | null;
  at: Date;
}>;

export type MessageSent = Readonly<{ type: "MessageSent"; conversationId: string; messageId: string; from: Side; buyerId: string; sellerId: string; preview: string; at: Date }>;

export type MessageError = DomainError<"empty_message" | "too_long" | "not_found" | "forbidden" | "unsupported_type" | "too_large" | "invalid_photo">;

export function startConversation(props: { id: string; buyer: { accountId: string; name: string }; sellerId: string; at: Date }): Conversation {
  return { id: props.id, buyerId: props.buyer.accountId, buyerName: props.buyer.name, sellerId: props.sellerId, createdAt: props.at, lastAt: props.at, lastText: "", lastFrom: "buyer", buyerReadAt: props.at, shopReadAt: null };
}

export function writeMessage(c: Conversation, props: { id: string; from: Side; authorId: string; text: string; productSlug: string | null; photo: string | null; at: Date }): Result<{ message: Message; conversation: Conversation }, MessageError> {
  const text = props.text.trim();
  if (!text && !props.productSlug && !props.photo) return err(domainError("empty_message", "Write something first."));
  if (text.length > MAX_MESSAGE) return err(domainError("too_long", `Keep it under ${MAX_MESSAGE} characters.`));
  const message: Message = { id: props.id, conversationId: c.id, from: props.from, authorId: props.authorId, text, productSlug: props.productSlug, photo: props.photo, at: props.at };
  const conversation: Conversation = {
    ...c,
    lastAt: props.at,
    lastText: text || (props.photo ? "Sent a photo" : "Shared a listing"),
    lastFrom: props.from,
    // Writing means you've read everything before it.
    ...(props.from === "buyer" ? { buyerReadAt: props.at } : { shopReadAt: props.at }),
  };
  return ok({ message, conversation });
}

/** Whether the other side has written since this side last read. */
export const unreadFor = (c: Conversation, side: Side) => {
  const read = side === "buyer" ? c.buyerReadAt : c.shopReadAt;
  return c.lastFrom !== side && c.lastText !== "" && (read === null || read.getTime() < c.lastAt.getTime());
};
