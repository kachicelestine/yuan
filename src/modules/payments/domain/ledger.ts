import { domainError, err, money, ok, type Cents, type DomainError, type Result } from "@/shared/kernel";

/**
 * Double-entry bookkeeping. Every movement of money is a journal of entries whose
 * amounts sum to zero, so funds are never created or lost, only moved between accounts:
 *   treasury:<rail>   stablecoins the platform holds on a network
 *   escrow:<orderId>  a buyer's payment held by Protect until delivery
 *   seller:<sellerId> what a seller has earned and can withdraw
 */
export type LedgerEntry = Readonly<{ account: string; amount: Cents }>;
export type Journal = Readonly<{ id: string; reference: string; memo: string; entries: readonly LedgerEntry[]; at: Date }>;

export const accounts = {
  treasury: (rail: string) => `treasury:${rail}`,
  escrow: (orderId: string) => `escrow:${orderId}`,
  seller: (sellerId: string) => `seller:${sellerId}`,
};

export function journal(props: Journal): Result<Journal, DomainError<"unbalanced_journal">> {
  const sum = money.add(...props.entries.map((e) => e.amount));
  if (props.entries.length < 2 || sum !== 0) return err(domainError("unbalanced_journal", `Journal ${props.reference} does not balance (${sum}).`));
  return ok(props);
}

/** A paid invoice: the treasury received the funds, which are owed to the order's escrow. */
export function paymentReceived(props: { id: string; invoiceId: string; orderId: string; rail: string; amount: Cents; at: Date }) {
  return journal({
    id: props.id,
    reference: `invoice:${props.invoiceId}`,
    memo: "Buyer payment held in escrow",
    at: props.at,
    entries: [
      { account: accounts.treasury(props.rail), amount: props.amount },
      { account: accounts.escrow(props.orderId), amount: money.cents(-props.amount) },
    ],
  });
}

// Platform accounts. Credits (negative) are what the platform earned or owes onward.
export const platform = {
  /** Commission earned on each released sale. */
  commission: "platform:commission",
  /** Shipping, duty and VAT collected, owed to carriers and customs. */
  logistics: "platform:logistics",
  /** Coupons the platform paid for. */
  promotions: "platform:promotions",
  /** Rounding and refunds' leftovers, reconciled by hand. */
  adjustments: "platform:adjustments",
  payoutsPending: "pending:payouts",
  refundsPending: "pending:refunds",
};

/** Commission on an amount, rounded to the cent. */
export const commissionOn = (amount: Cents, rate: number) => money.cents(Math.round(amount * rate));

/** A shop's parcel was delivered: its share leaves escrow, less the platform's commission. */
export function sellerRelease(props: { id: string; orderId: string; sellerId: string; amount: Cents; commissionRate: number; at: Date }) {
  const fee = commissionOn(props.amount, props.commissionRate);
  return journal({
    id: props.id,
    reference: `release:${props.orderId}:${props.sellerId}`,
    memo: "Protect released to the shop",
    at: props.at,
    entries: [
      { account: accounts.escrow(props.orderId), amount: props.amount },
      { account: accounts.seller(props.sellerId), amount: money.cents(-(props.amount - fee)) },
      ...(fee > 0 ? [{ account: platform.commission, amount: money.cents(-fee) }] : []),
    ],
  });
}

/** A parcel was refunded: its share leaves escrow, owed back to the buyer until sent. */
export function refundOwed(props: { id: string; orderId: string; sellerId: string; amount: Cents; at: Date }) {
  return journal({
    id: props.id,
    reference: `refund:${props.orderId}:${props.sellerId}`,
    memo: "Protect refund owed to the buyer",
    at: props.at,
    entries: [
      { account: accounts.escrow(props.orderId), amount: props.amount },
      { account: platform.refundsPending, amount: money.cents(-props.amount) },
    ],
  });
}

/**
 * The order is done. Parcels release (or refund) the shops' lines one by one; what the buyer
 * paid beyond the lines (shipping, duty, VAT, less the coupon) is the remainder, and it goes
 * to logistics, with the coupon booked as a promotion. Computed from the order rather than
 * the escrow balance, so it's right whichever order the events are processed in.
 */
export function orderSettled(props: { id: string; orderId: string; remainder: Cents; discount: Cents; at: Date }) {
  return journal({
    id: props.id,
    reference: `settle:${props.orderId}`,
    memo: "Order complete; escrow closed",
    at: props.at,
    entries: [
      { account: accounts.escrow(props.orderId), amount: props.remainder },
      { account: platform.logistics, amount: money.cents(-(props.remainder + props.discount)) },
      { account: platform.promotions, amount: props.discount },
    ].filter((e) => e.amount !== 0),
  });
}

/** A payout is requested: the amount moves out of the shop's balance while it's sent. */
export function payoutRequested(props: { id: string; payoutId: string; sellerId: string; amount: Cents; at: Date }) {
  return journal({
    id: props.id,
    reference: `payout:${props.payoutId}`,
    memo: "Payout requested",
    at: props.at,
    entries: [
      { account: accounts.seller(props.sellerId), amount: props.amount },
      { account: platform.payoutsPending, amount: money.cents(-props.amount) },
    ],
  });
}

/** A payout was cancelled: the amount returns to the shop's balance. */
export function payoutCancelled(props: { id: string; payoutId: string; sellerId: string; amount: Cents; at: Date }) {
  return journal({
    id: props.id,
    reference: `payout-cancelled:${props.payoutId}`,
    memo: "Payout cancelled",
    at: props.at,
    entries: [
      { account: platform.payoutsPending, amount: props.amount },
      { account: accounts.seller(props.sellerId), amount: money.cents(-props.amount) },
    ],
  });
}

/** Money left the treasury on-chain (a payout or a refund). */
export function disbursed(props: { id: string; disbursementId: string; kind: "payout" | "refund"; rail: string; amount: Cents; at: Date }) {
  return journal({
    id: props.id,
    reference: `sent:${props.disbursementId}`,
    memo: props.kind === "payout" ? "Payout sent" : "Refund sent",
    at: props.at,
    entries: [
      { account: props.kind === "payout" ? platform.payoutsPending : platform.refundsPending, amount: props.amount },
      { account: accounts.treasury(props.rail), amount: money.cents(-props.amount) },
    ],
  });
}
