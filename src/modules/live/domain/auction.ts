import { domainError, err, money, ok, type Cents, type DomainError, type Result } from "@/shared/kernel";

// Auctions sell one unit per lot. Bids must beat the top bid by the increment; a bid in the
// last seconds pushes the close back, so nobody wins by sniping. The winner gets a price
// hold at the hammer price and pays through the normal checkout.

/** A bid this close to the end extends the lot to this much time left. */
export const SNIPE_WINDOW_MS = 10_000;

export type LotStatus = "open" | "sold" | "unsold";

export type Lot = Readonly<{
  id: string;
  showId: string;
  slug: string;
  startPrice: Cents;
  increment: Cents;
  endsAt: Date;
  status: LotStatus;
  topBid: Readonly<{ amount: Cents; bidderId: string; bidderName: string; at: Date }> | null;
  bids: number;
  /** Optimistic concurrency: each change bumps it, and a save only applies over the version it read. */
  version: number;
}>;

export type LotError = DomainError<"invalid_lot" | "lot_closed" | "bid_too_low" | "own_bid">;

export type LotSold = Readonly<{ type: "LotSold"; lotId: string; showId: string; slug: string; winnerId: string; amount: Cents; at: Date }>;

export function openLot(props: { id: string; showId: string; slug: string; startPrice: Cents; increment: Cents; durationMs: number; at: Date }): Result<Lot, LotError> {
  if (props.startPrice <= 0) return err(domainError("invalid_lot", "Start the lot above $0."));
  if (props.increment < money.fromDollars(0.5)) return err(domainError("invalid_lot", "Bids should go up by at least $0.50."));
  if (props.durationMs < 30_000 || props.durationMs > 30 * 60_000) return err(domainError("invalid_lot", "Run a lot for 30 seconds to 30 minutes."));
  return ok({ id: props.id, showId: props.showId, slug: props.slug, startPrice: props.startPrice, increment: props.increment, endsAt: new Date(props.at.getTime() + props.durationMs), status: "open", topBid: null, bids: 0, version: 0 });
}

/** The least the next bid can be. */
export const minimumBid = (lot: Lot): Cents => (lot.topBid ? money.add(lot.topBid.amount, lot.increment) : lot.startPrice);

export function placeBid(lot: Lot, bidder: { id: string; name: string }, amount: Cents, at: Date): Result<Lot, LotError> {
  if (lot.status !== "open" || at.getTime() >= lot.endsAt.getTime()) return err(domainError("lot_closed", "Bidding on this lot has closed."));
  if (lot.topBid?.bidderId === bidder.id) return err(domainError("own_bid", "You're already the top bidder."));
  if (amount < minimumBid(lot)) return err(domainError("bid_too_low", `Bid at least $${(minimumBid(lot) / 100).toFixed(2)}.`));
  const left = lot.endsAt.getTime() - at.getTime();
  const endsAt = left < SNIPE_WINDOW_MS ? new Date(at.getTime() + SNIPE_WINDOW_MS) : lot.endsAt;
  return ok({ ...lot, endsAt, topBid: { amount, bidderId: bidder.id, bidderName: bidder.name, at }, bids: lot.bids + 1, version: lot.version + 1 });
}

/** Once the clock runs out: sold to the top bidder, or unsold. Closing twice changes nothing. */
export function closeLot(lot: Lot, at: Date): { lot: Lot; event: LotSold | null } {
  if (lot.status !== "open" || at.getTime() < lot.endsAt.getTime()) return { lot, event: null };
  if (!lot.topBid) return { lot: { ...lot, status: "unsold", version: lot.version + 1 }, event: null };
  return {
    lot: { ...lot, status: "sold", version: lot.version + 1 },
    event: { type: "LotSold", lotId: lot.id, showId: lot.showId, slug: lot.slug, winnerId: lot.topBid.bidderId, amount: lot.topBid.amount, at },
  };
}
