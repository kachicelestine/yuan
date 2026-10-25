import { domainError, err, ok, type DomainError, type Result } from "@/shared/kernel";

// A gift is an order paid by one person and delivered to another, who adds their own
// address (and, if the sender allowed it, picks the option) through a private link. Until
// then the shop can't ship it. The price can be hidden from the recipient; the note is
// printed on a card by the shop. Duties are always prepaid, so they pay nothing at the door.

export const GIFT_THEMES = ["thanks", "birthday", "newyear", "love"] as const;
export type GiftTheme = (typeof GIFT_THEMES)[number];
export const GIFT_THANKS = ["❤️", "🥹", "🙏", "🎉"] as const;

export type Gift = Readonly<{
  orderId: string;
  /** The secret in the recipient's link. */
  token: string;
  senderId: string;
  /** How the sender signs the card. */
  fromName: string;
  recipientName: string;
  theme: GiftTheme;
  message: string;
  hidePrice: boolean;
  /** The option the recipient picks (e.g. "Size"), or null when the sender chose. */
  chooseOption: string | null;
  /** What the recipient picked. */
  choice: string | null;
  claimedAt: Date | null;
  /** Who added the address: the recipient through the link, or the sender. */
  claimedBy: "recipient" | "sender" | null;
  thanks: string | null;
  createdAt: Date;
}>;

export type GiftInput = { fromName: string; recipientName: string; theme: string; message: string; hidePrice: boolean; chooseOption: string | null };

export type GiftError = DomainError<"invalid_gift" | "gift_claimed" | "gift_unpaid" | "invalid_choice">;

const tidy = (s: string) => s.trim().replace(/\s+/g, " ");
const bad = (message: string) => err(domainError("invalid_gift", message));

export function createGift(p: { orderId: string; token: string; senderId: string; input: GiftInput; at: Date }): Result<Gift, GiftError> {
  const fromName = tidy(p.input.fromName);
  const recipientName = tidy(p.input.recipientName);
  const message = p.input.message.trim();
  if (recipientName.length < 1 || recipientName.length > 40) return bad("Say who it's for.");
  if (fromName.length < 1 || fromName.length > 40) return bad("Say how to sign the card.");
  if (message.length > 200) return bad("Keep the note under 200 characters.");
  if (!(GIFT_THEMES as readonly string[]).includes(p.input.theme)) return bad("Pick a card.");
  return ok({
    orderId: p.orderId,
    token: p.token,
    senderId: p.senderId,
    fromName,
    recipientName,
    theme: p.input.theme as GiftTheme,
    message,
    hidePrice: p.input.hidePrice,
    chooseOption: p.input.chooseOption,
    choice: null,
    claimedAt: null,
    claimedBy: null,
    thanks: null,
    createdAt: p.at,
  });
}

/**
 * The address is in: the gift can ship. `choices` are the values the recipient may pick
 * from when the sender let them choose.
 */
export function claimGift(g: Gift, p: { by: "recipient" | "sender"; choice: string | null; choices: readonly string[]; paid: boolean; at: Date }): Result<Gift, GiftError> {
  if (!p.paid) return err(domainError("gift_unpaid", "This gift hasn't been paid for yet."));
  if (g.claimedAt) return err(domainError("gift_claimed", "The address for this gift is already in."));
  let choice: string | null = null;
  if (g.chooseOption) {
    if (p.choice === null && p.by === "sender") choice = null;
    else if (!p.choice || !p.choices.includes(p.choice)) return err(domainError("invalid_choice", `Pick a ${g.chooseOption.toLowerCase()}.`));
    else choice = p.choice;
  }
  return ok({ ...g, choice, claimedAt: p.at, claimedBy: p.by });
}

export function thankSender(g: Gift, emoji: string): Result<Gift, GiftError> {
  if (!(GIFT_THANKS as readonly string[]).includes(emoji)) return bad("Pick one of the reactions.");
  return ok({ ...g, thanks: emoji });
}

export type GiftClaimed = Readonly<{ type: "GiftClaimed"; orderId: string; senderId: string; recipientName: string; by: "recipient" | "sender"; at: Date }>;
