import { domainError, err, ok, type Clock, type EventLog, type ObjectStorage, type Result } from "@/shared/kernel";
import { startConversation, unreadFor, writeMessage, type Conversation, type Message, type MessageError, type MessageSent, type Side } from "../domain/conversation";
import type { ConversationRepository, MessageRepository } from "../domain/repositories";

export type MessagingScope = { conversations: ConversationRepository; messages: MessageRepository; events: EventLog };

export type MessagingDeps = {
  conversations: ConversationRepository;
  messages: MessageRepository;
  /** Whether a shop exists and can be written to (catalog owns shops). */
  shops: { exists(sellerId: string): Promise<boolean> };
  /** Private storage: chat photos are never public. */
  photos: Pick<ObjectStorage, "signUpload" | "head" | "signDownload">;
  uow: { run<T>(work: (scope: MessagingScope) => Promise<T>): Promise<T> };
  clock: Clock;
  newId: () => string;
};

export type ConversationView = { id: string; sellerId: string; buyerName: string; lastText: string; lastFrom: Side; lastAt: string; unread: boolean };
/** `photo` is a short-lived link to the picture. */
export type MessageView = { id: string; from: Side; text: string; productSlug: string | null; photo: string | null; at: string };

const PHOTO_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;
/** How long a photo link works; reopening the chat makes fresh ones. */
const PHOTO_LINK_SECONDS = 6 * 3600;
/** Who uploaded a chat photo is part of its key, so nobody can send someone else's. */
const photoPrefix = (accountId: string) => `chat/${accountId}/`;

const conversationView = (c: Conversation, side: Side): ConversationView => ({
  id: c.id,
  sellerId: c.sellerId,
  buyerName: c.buyerName,
  lastText: c.lastText,
  lastFrom: c.lastFrom,
  lastAt: c.lastAt.toISOString(),
  unread: unreadFor(c, side),
});

/** Who is reading or writing: a shopper, or someone working at a shop. */
export type Party = { side: "buyer"; accountId: string; name: string } | { side: "shop"; accountId: string; sellerId: string };

export function makeMessaging({ conversations, messages, shops, photos, uow, clock, newId }: MessagingDeps) {
  const messageView = async (m: Message): Promise<MessageView> => ({ id: m.id, from: m.from, text: m.text, productSlug: m.productSlug, photo: m.photo ? await photos.signDownload(m.photo, PHOTO_LINK_SECONDS) : null, at: m.at.toISOString() });
  const messageViews = (list: readonly Message[]) => Promise.all(list.map(messageView));

  /** The conversation if this party belongs in it. */
  async function open(id: string, party: Party): Promise<Conversation | null> {
    const c = await conversations.find(id);
    if (!c) return null;
    if (party.side === "buyer" ? c.buyerId !== party.accountId : c.sellerId !== party.sellerId) return null;
    return c;
  }

  async function send(c: Conversation, party: Party, text: string, productSlug: string | null, photo: string | null): Promise<Result<MessageView, MessageError>> {
    if (photo && (!photo.startsWith(photoPrefix(party.accountId)) || !(await photos.head(photo)))) return err(domainError("invalid_photo", "The photo didn't finish uploading. Try again."));
    const w = writeMessage(c, { id: newId(), from: party.side, authorId: party.accountId, text, productSlug, photo, at: clock.now() });
    if (!w.ok) return w;
    const event: MessageSent = { type: "MessageSent", conversationId: c.id, messageId: w.value.message.id, from: party.side, buyerId: c.buyerId, sellerId: c.sellerId, preview: w.value.conversation.lastText.slice(0, 140), at: clock.now() };
    await uow.run(async (s) => {
      await s.messages.add(w.value.message);
      await s.conversations.save(w.value.conversation);
      await s.events.record(c.id, event);
    });
    return ok(await messageView(w.value.message));
  }

  return {
    /** A ticket to upload a photo for a message, straight to private storage. Send it with the key. */
    async startPhoto(accountId: string, file: { contentType: string; bytes: number }): Promise<Result<{ url: string; method: "PUT"; headers: Readonly<Record<string, string>>; photo: string }, MessageError>> {
      const ext = PHOTO_TYPES[file.contentType];
      if (!ext) return err(domainError("unsupported_type", "Send a JPEG, PNG or WebP photo."));
      if (!Number.isSafeInteger(file.bytes) || file.bytes <= 0 || file.bytes > MAX_PHOTO_BYTES) return err(domainError("too_large", "Photos can be up to 8 MB."));
      const photo = `${photoPrefix(accountId)}${newId()}.${ext}`;
      return ok({ ...(await photos.signUpload(photo, file, 15 * 60)), photo });
    },

    /** A shopper's chats, latest first. */
    async buyerInbox(buyerId: string, limit = 50): Promise<ConversationView[]> {
      return (await conversations.forBuyer(buyerId, limit)).map((c) => conversationView(c, "buyer"));
    },

    /** A shop's chats with buyers, latest first. */
    async shopInbox(sellerId: string, limit = 100): Promise<ConversationView[]> {
      return (await conversations.forSeller(sellerId, limit)).map((c) => conversationView(c, "shop"));
    },

    async unread(party: Party): Promise<number> {
      const list = party.side === "buyer" ? await conversations.forBuyer(party.accountId, 200) : await conversations.forSeller(party.sellerId, 200);
      return list.filter((c) => unreadFor(c, party.side)).length;
    },

    /** The shopper's thread with a shop (made on the first message, not on viewing). */
    async withShop(buyerId: string, sellerId: string): Promise<{ conversation: ConversationView | null; messages: MessageView[] }> {
      const c = await conversations.between(buyerId, sellerId);
      if (!c) return { conversation: null, messages: [] };
      return { conversation: conversationView(c, "buyer"), messages: await messageViews(await messages.list(c.id, { limit: 100 })) };
    },

    async thread(id: string, party: Party, after?: Date): Promise<{ conversation: ConversationView; messages: MessageView[] } | null> {
      const c = await open(id, party);
      if (!c) return null;
      return { conversation: conversationView(c, party.side), messages: await messageViews(await messages.list(id, { limit: 100, after })) };
    },

    /** A shopper writes to a shop, starting the conversation if this is the first message. */
    async toShop(buyer: { accountId: string; name: string }, sellerId: string, text: string, productSlug: string | null = null, photo: string | null = null): Promise<Result<{ conversationId: string; message: MessageView }, MessageError>> {
      if (!(await shops.exists(sellerId))) return err(domainError("not_found", "No such shop."));
      let c = await conversations.between(buyer.accountId, sellerId);
      if (!c) {
        const fresh = startConversation({ id: newId(), buyer, sellerId, at: clock.now() });
        c = (await conversations.create(fresh)) ? fresh : await conversations.between(buyer.accountId, sellerId);
        if (!c) throw new Error("Conversation vanished");
      }
      const r = await send(c, { side: "buyer", ...buyer }, text, productSlug, photo);
      return r.ok ? ok({ conversationId: c.id, message: r.value }) : r;
    },

    /** Someone at the shop replies in a conversation. */
    async reply(id: string, party: Extract<Party, { side: "shop" }>, text: string, productSlug: string | null = null, photo: string | null = null): Promise<Result<MessageView, MessageError>> {
      const c = await open(id, party);
      if (!c) return err(domainError("not_found", "No such conversation."));
      return send(c, party, text, productSlug, photo);
    },

    async markRead(id: string, party: Party) {
      const c = await open(id, party);
      if (c && unreadFor(c, party.side)) await conversations.markRead(id, party.side, clock.now());
    },
  };
}

export type Messaging = ReturnType<typeof makeMessaging>;
