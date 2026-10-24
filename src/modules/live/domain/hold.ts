import { domainError, err, ok, type Cents, type DomainError, type Result } from "@/shared/kernel";

// A price hold lets one person buy a product at a special price for a while: the live price
// they tapped during a show, or the hammer price of a lot they won. Checkout honours an
// active hold; paying for the order uses it up.

export type HoldSource = Readonly<{ kind: "live"; showId: string } | { kind: "lot"; lotId: string }>;

export type PriceHold = Readonly<{
  id: string;
  accountId: string;
  slug: string;
  price: Cents;
  /** Most units the price applies to. */
  qty: number;
  source: HoldSource;
  expiresAt: Date;
  usedAt: Date | null;
  createdAt: Date;
}>;

/** A live price is held long enough to finish checking out after the show. */
export const LIVE_HOLD_MS = 30 * 60_000;
/** Auction winners get two days to pay. */
export const LOT_HOLD_MS = 48 * 3_600_000;
export const LIVE_HOLD_QTY = 5;

export type HoldError = DomainError<"no_live_price">;

export function holdLivePrice(props: { id: string; accountId: string; slug: string; price: Cents | null; showId: string; at: Date }): Result<PriceHold, HoldError> {
  if (props.price === null) return err(domainError("no_live_price", "There's no live price on this right now."));
  return ok({
    id: props.id,
    accountId: props.accountId,
    slug: props.slug,
    price: props.price,
    qty: LIVE_HOLD_QTY,
    source: { kind: "live", showId: props.showId },
    expiresAt: new Date(props.at.getTime() + LIVE_HOLD_MS),
    usedAt: null,
    createdAt: props.at,
  });
}

export function holdHammerPrice(props: { id: string; accountId: string; slug: string; price: Cents; lotId: string; at: Date }): PriceHold {
  return { id: props.id, accountId: props.accountId, slug: props.slug, price: props.price, qty: 1, source: { kind: "lot", lotId: props.lotId }, expiresAt: new Date(props.at.getTime() + LOT_HOLD_MS), usedAt: null, createdAt: props.at };
}

export const isActive = (h: PriceHold, at: Date) => h.usedAt === null && h.expiresAt.getTime() > at.getTime();
