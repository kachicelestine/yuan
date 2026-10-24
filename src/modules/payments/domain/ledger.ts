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
