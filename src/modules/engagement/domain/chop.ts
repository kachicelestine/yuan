import { domainError, err, money, ok, type Cents, type DomainError, type Result } from "@/shared/kernel";

// Price chop with friends, made fair: a shop offers a listing at a fixed target price
// reached by a fixed number of equal cuts, within a clock that never resets. A shopper
// starts a chop (making the first cut), friends add theirs with one tap, and at the target
// the shopper may buy one at that price for two days. The shop funds the discount; each
// started chop holds one unit of the offer's stock until it completes or runs out of time.

export const CHOP_HOLD_MS = 48 * 3_600_000;
/** Cuts one person may give others per day, so nobody farms chops with many tabs. */
export const CUTS_PER_DAY = 10;

export type ChopOffer = Readonly<{
  id: string;
  sellerId: string;
  slug: string;
  /** The listing's normal price when the offer was made, and the price at the end. */
  fullPrice: Cents;
  target: Cents;
  cuts: number;
  hours: number;
  /** Chops that can still be started (each reserves one). */
  remaining: number;
  active: boolean;
  createdAt: Date;
}>;

export type ChopStatus = "open" | "done" | "expired" | "used";

export type Chop = Readonly<{
  id: string;
  offerId: string;
  ownerId: string;
  ownerName: string;
  slug: string;
  fullPrice: Cents;
  target: Cents;
  cuts: number;
  startedAt: Date;
  endsAt: Date;
  status: ChopStatus;
  /** When the target was reached; the price holds for CHOP_HOLD_MS after. */
  doneAt: Date | null;
}>;

export type ChopCut = Readonly<{ chopId: string; cutter: string; name: string; at: Date }>;

export type ChopCompleted = Readonly<{ type: "ChopCompleted"; chopId: string; ownerId: string; slug: string; target: Cents; at: Date }>;

export type ChopError = DomainError<"invalid_offer" | "sold_out" | "chop_closed" | "own_chop" | "already_cut" | "too_many_cuts" | "not_found">;

export function makeOffer(props: { id: string; sellerId: string; slug: string; fullPrice: Cents; target: Cents; cuts: number; hours: number; stock: number; at: Date }): Result<ChopOffer, ChopError> {
  if (!Number.isInteger(props.cuts) || props.cuts < 2 || props.cuts > 10) return err(domainError("invalid_offer", "Ask for 2 to 10 cuts."));
  if (![12, 24, 48].includes(props.hours)) return err(domainError("invalid_offer", "Give friends 12, 24 or 48 hours."));
  if (!Number.isInteger(props.stock) || props.stock < 1 || props.stock > 1000) return err(domainError("invalid_offer", "Offer 1 to 1,000."));
  if (!(props.target > 0 && props.target <= props.fullPrice * 0.9)) return err(domainError("invalid_offer", "The target must be at least 10% below the normal price."));
  return ok({ id: props.id, sellerId: props.sellerId, slug: props.slug, fullPrice: props.fullPrice, target: props.target, cuts: props.cuts, hours: props.hours, remaining: props.stock, active: true, createdAt: props.at });
}

/** The same slice comes off with every cut. */
export const cutSize = (c: Pick<Chop, "fullPrice" | "target" | "cuts">) => money.cents(Math.floor((c.fullPrice - c.target) / c.cuts));

/** The price after `done` cuts; exactly the target once all are in. */
export const priceAfter = (c: Pick<Chop, "fullPrice" | "target" | "cuts">, done: number) =>
  done >= c.cuts ? c.target : money.cents(c.fullPrice - cutSize(c) * done);

export function startChop(offer: ChopOffer, props: { id: string; owner: { accountId: string; name: string }; at: Date }): Result<Chop, ChopError> {
  if (!offer.active) return err(domainError("invalid_offer", "This chop isn't on offer any more."));
  if (offer.remaining < 1) return err(domainError("sold_out", "Every chop for this one has been taken."));
  return ok({
    id: props.id,
    offerId: offer.id,
    ownerId: props.owner.accountId,
    ownerName: props.owner.name,
    slug: offer.slug,
    fullPrice: offer.fullPrice,
    target: offer.target,
    cuts: offer.cuts,
    startedAt: props.at,
    endsAt: new Date(props.at.getTime() + offer.hours * 3_600_000),
    status: "open",
    doneAt: null,
  });
}

/** Whether `cutter` may add a cut now; `done` counts the cuts already in (the owner's included). */
export function canCut(chop: Chop, cutter: { id: string; accountId: string | null }, done: number, cutsToday: number, at: Date): ChopError | null {
  if (chop.status !== "open" || at.getTime() >= chop.endsAt.getTime() || done >= chop.cuts) return domainError("chop_closed", "This chop has finished.");
  if (cutter.accountId === chop.ownerId || cutter.id === chop.ownerId) return domainError("own_chop", "Send it to friends: they make the cuts.");
  if (cutsToday >= CUTS_PER_DAY) return domainError("too_many_cuts", "You've cut a lot today. Try again tomorrow.");
  return null;
}

export const holdsUntil = (chop: Chop) => (chop.doneAt ? new Date(chop.doneAt.getTime() + CHOP_HOLD_MS) : null);

/** The target price this owner can buy at now, if the chop is done and not used or lapsed. */
export const heldPrice = (chop: Chop, at: Date) => (chop.status === "done" && holdsUntil(chop)!.getTime() > at.getTime() ? chop.target : null);
