import { domainError, err, ok, type Cents, type DomainError, type Result } from "@/shared/kernel";

// Pre-orders and pre-sales. A shop offers a listing for a deposit now and the balance
// later. Pre-order: the deposit counts in full and the balance opens when it ships.
// Pre-sale (11.11): a small deposit counts for more on the festival day. Deposits are
// held by Protect; the shop gets one when the order it went toward is delivered, or when
// the buyer lets the balance window pass (said up front). If the shop cancels, every
// deposit is refunded.

export const DEPOSIT_KINDS = ["preorder", "presale"] as const;
export type DepositKind = (typeof DEPOSIT_KINDS)[number];

const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export type DepositOffer = Readonly<{
  id: string;
  sellerId: string;
  slug: string;
  kind: DepositKind;
  title: string;
  blurb: string;
  /** Paid now. */
  deposit: Cents;
  /** What the deposit counts for when the balance is paid (pre-orders: the deposit). */
  credit: Cents;
  /** The full price; the balance is price − credit. */
  price: Cents;
  /** When deposits can be put down. */
  opensAt: Date;
  closesAt: Date;
  /** When the balance can be paid. */
  balanceFrom: Date;
  balanceUntil: Date;
  stock: number;
  perPerson: number;
  /** Deposits put down (pending or paid). */
  taken: number;
  cancelled: boolean;
  createdAt: Date;
}>;

export type DepositStatus = "pending" | "paid" | "converted" | "lapsed" | "forfeited" | "refunded";

export type Deposit = Readonly<{
  id: string;
  offerId: string;
  buyerId: string;
  /** The deposit's own order (paid through an invoice like any order). */
  orderId: string | null;
  status: DepositStatus;
  /** The order that paid the balance. */
  finalOrderId: string | null;
  createdAt: Date;
  paidAt: Date | null;
  /** When the buyer was told the balance window opened. */
  remindedAt: Date | null;
}>;

export type DepositError = DomainError<"invalid_offer" | "not_open" | "sold_out" | "limit_reached" | "not_found" | "closed">;

const bad = (message: string) => err(domainError("invalid_offer", message));

/** The 11.11 balance window: all of 11 November, Beijing time. */
export function festivalWindow(year: number) {
  const from = new Date(Date.UTC(year, 10, 11) - 8 * HOUR);
  return { from, until: new Date(from.getTime() + DAY) };
}

export type OfferInput = { slug: string; kind: string; title: string; blurb: string; deposit: Cents; credit: Cents; price: Cents; opensAt: Date; closesAt: Date; balanceFrom: Date; balanceUntil: Date; stock: number; perPerson: number };

export function createOffer(p: { id: string; sellerId: string; input: OfferInput; at: Date }): Result<DepositOffer, DepositError> {
  const i = p.input;
  if (!(DEPOSIT_KINDS as readonly string[]).includes(i.kind)) return bad("Pick pre-order or pre-sale.");
  const title = i.title.trim();
  if (title.length < 3 || title.length > 80) return bad("Give it a title (up to 80 characters).");
  if (i.blurb.trim().length > 200) return bad("Keep the description under 200 characters.");
  if (!Number.isInteger(i.price) || i.price < 100) return bad("Set the full price.");
  if (!Number.isInteger(i.deposit) || i.deposit < 100 || i.deposit >= i.price) return bad("The deposit must be at least $1 and less than the price.");
  const credit = i.kind === "preorder" ? i.deposit : i.credit;
  if (!Number.isInteger(credit) || credit < i.deposit) return bad("What the deposit counts for can't be less than the deposit.");
  if (credit > i.deposit * 5 || credit > i.price / 2) return bad("A deposit can count for at most 5 times itself, and half the price.");
  if (!(i.opensAt < i.closesAt && i.closesAt <= i.balanceFrom && i.balanceFrom < i.balanceUntil)) return bad("Deposits close before the balance opens, and each window needs a start and an end.");
  if (i.closesAt.getTime() - i.opensAt.getTime() > 120 * DAY) return bad("Take deposits for at most 120 days.");
  const balanceSpan = i.balanceUntil.getTime() - i.balanceFrom.getTime();
  if (balanceSpan < 12 * HOUR || balanceSpan > 30 * DAY) return bad("Give buyers 12 hours to 30 days to pay the balance.");
  if (i.closesAt <= p.at) return bad("The deposit window has to end in the future.");
  if (!Number.isInteger(i.stock) || i.stock < 1 || i.stock > 10_000) return bad("Stock must be 1 to 10,000.");
  if (!Number.isInteger(i.perPerson) || i.perPerson < 1 || i.perPerson > 5) return bad("Allow 1 to 5 per person.");
  return ok({ id: p.id, sellerId: p.sellerId, slug: i.slug, kind: i.kind as DepositKind, title, blurb: i.blurb.trim(), deposit: i.deposit, credit: credit as Cents, price: i.price, opensAt: i.opensAt, closesAt: i.closesAt, balanceFrom: i.balanceFrom, balanceUntil: i.balanceUntil, stock: i.stock, perPerson: i.perPerson, taken: 0, cancelled: false, createdAt: p.at });
}

export const isOpenForDeposits = (o: DepositOffer, now: Date) => !o.cancelled && now >= o.opensAt && now < o.closesAt;
export const balanceOf = (o: Pick<DepositOffer, "price" | "credit">) => (o.price - o.credit) as Cents;

/** A buyer puts a deposit down (pending until its order is paid). */
export function reserve(p: { offer: DepositOffer; id: string; buyerId: string; holding: number; at: Date }): Result<Deposit, DepositError> {
  if (!isOpenForDeposits(p.offer, p.at)) return err(domainError("not_open", p.offer.cancelled ? "The shop cancelled this." : p.at < p.offer.opensAt ? "Deposits haven't opened yet." : "Deposits have closed."));
  if (p.holding >= p.offer.perPerson) return err(domainError("limit_reached", `${p.offer.perPerson === 1 ? "One" : p.offer.perPerson} per person.`));
  if (p.offer.taken >= p.offer.stock) return err(domainError("sold_out", "All the deposits are taken."));
  return ok({ id: p.id, offerId: p.offer.id, buyerId: p.buyerId, orderId: null, status: "pending", finalOrderId: null, createdAt: p.at, paidAt: null, remindedAt: null });
}

/** The price a paid deposit holds while the balance window is open: price − credit, for one. */
export function balanceHold(d: Deposit, o: DepositOffer, now: Date): { price: Cents; qty: number } | null {
  if (d.status !== "paid" || o.cancelled || now < o.balanceFrom || now >= o.balanceUntil) return null;
  return { price: balanceOf(o), qty: 1 };
}
