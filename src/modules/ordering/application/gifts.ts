import { domainError, err, ok, type Clock, type DomainError, type EventLog, type Result } from "@/shared/kernel";
import { cleanAddress, type AddressError, type AddressInput } from "../domain/address";
import { claimGift, thankSender, type Gift, type GiftClaimed, type GiftError, type GiftTheme } from "../domain/gift";
import type { Order } from "../domain/order";
import type { GiftRepository, OrderRepository } from "../domain/repositories";

export type GiftScope = { orders: OrderRepository; gifts: GiftRepository; events: EventLog };

export type GiftsDeps = {
  gifts: GiftRepository;
  orders: OrderRepository;
  uow: { run<T>(work: (scope: GiftScope) => Promise<T>): Promise<T> };
  clock: Clock;
};

export type GiftState = "unpaid" | "waiting" | "on_its_way" | "cancelled";

/** What the recipient sees through the link (never the price when it's hidden, never the sender's account). */
export type GiftView = {
  token: string;
  fromName: string;
  recipientName: string;
  theme: GiftTheme;
  message: string;
  country: string;
  slug: string;
  title: string;
  image: string;
  /** Hidden from the recipient when the sender asked. */
  price: number | null;
  option: string | null;
  chooseOption: string | null;
  choice: string | null;
  state: GiftState;
  thanks: string | null;
};

/** What the sender (and the shop) see about a gift order. */
export type GiftSummary = { orderId: string; token: string; recipientName: string; message: string; hidePrice: boolean; chooseOption: string | null; choice: string | null; claimed: boolean; claimedBy: Gift["claimedBy"]; thanks: string | null };

const stateOf = (o: Order, g: Gift): GiftState => (o.status === "cancelled" ? "cancelled" : o.status === "awaiting_payment" ? "unpaid" : g.claimedAt ? "on_its_way" : "waiting");

export const giftSummary = (g: Gift): GiftSummary => ({
  orderId: g.orderId,
  token: g.token,
  recipientName: g.recipientName,
  message: g.message,
  hidePrice: g.hidePrice,
  chooseOption: g.chooseOption,
  choice: g.choice,
  claimed: g.claimedAt !== null,
  claimedBy: g.claimedBy,
  thanks: g.thanks,
});

export function makeGifts({ gifts, orders, uow, clock }: GiftsDeps) {
  async function load(token: string) {
    const g = await gifts.byToken(token);
    const o = g ? await orders.findById(g.orderId) : null;
    return g && o ? { g, o } : null;
  }

  const view = (g: Gift, o: Order): GiftView => {
    const line = o.lines[0];
    return {
      token: g.token,
      fromName: g.fromName,
      recipientName: g.recipientName,
      theme: g.theme,
      message: g.message,
      country: o.country,
      slug: line.slug,
      title: line.title,
      image: line.image,
      price: g.hidePrice ? null : line.unitPrice / 100,
      option: g.chooseOption ? null : line.option,
      chooseOption: g.chooseOption,
      choice: g.choice,
      state: stateOf(o, g),
      thanks: g.thanks,
    };
  };

  async function claim(g: Gift, o: Order, by: "recipient" | "sender", input: AddressInput, choice: string | null, choices: readonly string[]): Promise<Result<Gift, GiftError | AddressError>> {
    const address = cleanAddress(input);
    if (!address.ok) return address;
    const claimed = claimGift(g, { by, choice, choices, paid: o.status === "paid" || o.status === "completed", at: clock.now() });
    if (!claimed.ok) return claimed;
    const event: GiftClaimed = { type: "GiftClaimed", orderId: o.id, senderId: g.senderId, recipientName: g.recipientName, by, at: clock.now() };
    const done = await uow.run(async (s) => {
      // The address goes on once; a second claim racing this one finds it taken.
      if (!(await s.orders.setAddress(o.id, address.value))) return false;
      await s.gifts.save(claimed.value);
      await s.events.record(o.id, event);
      return true;
    });
    return done ? ok(claimed.value) : err(domainError("gift_claimed", "The address for this gift is already in."));
  }

  return {
    /** The gift behind a link, as its recipient sees it. */
    async view(token: string): Promise<GiftView | null> {
      const found = await load(token);
      return found ? view(found.g, found.o) : null;
    },

    /** The recipient adds their address (and picks from `choices` when allowed). */
    async claim(token: string, input: AddressInput, choice: string | null, choices: readonly string[]): Promise<Result<GiftView, GiftError | AddressError | DomainError404>> {
      const found = await load(token);
      if (!found) return err(domainError("not_found", "This gift link doesn't work. Ask the sender for a new one."));
      const r = await claim(found.g, found.o, "recipient", input, choice, choices);
      return r.ok ? ok(view(r.value, found.o)) : r;
    },

    async thank(token: string, emoji: string): Promise<Result<{ senderId: string; recipientName: string; emoji: string }, GiftError | DomainError404>> {
      const found = await load(token);
      if (!found) return err(domainError("not_found", "No such gift."));
      if (found.g.thanks === emoji) return ok({ senderId: found.g.senderId, recipientName: found.g.recipientName, emoji });
      const r = thankSender(found.g, emoji);
      if (!r.ok) return r;
      await gifts.save(r.value);
      return ok({ senderId: found.g.senderId, recipientName: found.g.recipientName, emoji });
    },

    /** The sender's own gift order. */
    async forSender(buyerId: string, orderId: string): Promise<GiftSummary | null> {
      const [g] = await gifts.forOrders([orderId]);
      return g && g.senderId === buyerId ? giftSummary(g) : null;
    },

    /** The sender knows the address and adds it themselves. */
    async senderAddress(buyerId: string, orderId: string, input: AddressInput): Promise<Result<GiftSummary, GiftError | AddressError | DomainError404>> {
      const [g] = await gifts.forOrders([orderId]);
      const o = g && g.senderId === buyerId ? await orders.findById(orderId) : null;
      if (!g || !o) return err(domainError("not_found", "No such gift."));
      const r = await claim(g, o, "sender", input, null, []);
      return r.ok ? ok(giftSummary(r.value)) : r;
    },

    /** Gift details for orders (for the shop: the card, the recipient's choice). */
    async forOrders(orderIds: readonly string[]): Promise<Map<string, GiftSummary>> {
      return new Map((await gifts.forOrders(orderIds)).map((g) => [g.orderId, giftSummary(g)]));
    },
  };
}

type DomainError404 = DomainError<"not_found">;

export type Gifts = ReturnType<typeof makeGifts>;
