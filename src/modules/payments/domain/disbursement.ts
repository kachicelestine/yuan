import { domainError, err, money, ok, type Cents, type DomainError, type Result } from "@/shared/kernel";

// Money leaving the treasury: payouts to shops and creators, and refunds to buyers. For now a person
// sends each one from the treasury wallet and records the transaction hash; the platform
// never holds a private key on the server. An automated sender (a custody API) can take
// over behind the same queue later.

/** payout: to a shop. creator: to a creator, from referral commissions. refund: to a buyer. */
export type DisbursementKind = "payout" | "creator" | "refund";
export type DisbursementStatus = "requested" | "sent" | "cancelled";

/** Payouts below this aren't worth the network fee. */
export const MIN_PAYOUT = money.fromDollars(20);

export type Disbursement = Readonly<{
  id: string;
  kind: DisbursementKind;
  /** Payouts: the shop. Refunds: the shop whose parcel is refunded. Creator payouts: none. */
  sellerId: string | null;
  /** Refunds only. */
  orderId: string | null;
  /** Refunds: the buyer's account. Creator payouts: the creator's. */
  accountId: string | null;
  amount: Cents;
  /** Where it goes; for refunds a moderator may fill it in when sending. */
  address: string | null;
  status: DisbursementStatus;
  txHash: string | null;
  note: string | null;
  requestedAt: Date;
  decidedAt: Date | null;
  decidedBy: string | null;
}>;

export type DisbursementError = DomainError<"too_small" | "insufficient_balance" | "invalid_address" | "invalid_tx" | "not_requested" | "invalid_note">;

const EVM_ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const EVM_TX = /^0x[a-fA-F0-9]{64}$/;

export function requestPayout(props: { id: string; sellerId: string; amount: Cents; available: Cents; address: string; at: Date }): Result<Disbursement, DisbursementError> {
  if (props.amount < MIN_PAYOUT) return err(domainError("too_small", "Payouts start at $20."));
  if (props.amount > props.available) return err(domainError("insufficient_balance", "That's more than your available balance."));
  if (!EVM_ADDRESS.test(props.address)) return err(domainError("invalid_address", "Add a payout wallet in your shop settings first."));
  return ok({
    id: props.id,
    kind: "payout",
    sellerId: props.sellerId,
    orderId: null,
    accountId: null,
    amount: props.amount,
    address: props.address,
    status: "requested",
    txHash: null,
    note: null,
    requestedAt: props.at,
    decidedAt: null,
    decidedBy: null,
  });
}

export function requestCreatorPayout(props: { id: string; accountId: string; amount: Cents; available: Cents; address: string; at: Date }): Result<Disbursement, DisbursementError> {
  if (props.amount < MIN_PAYOUT) return err(domainError("too_small", "Payouts start at $20."));
  if (props.amount > props.available) return err(domainError("insufficient_balance", "That's more than your available balance."));
  if (!EVM_ADDRESS.test(props.address)) return err(domainError("invalid_address", "Add your USDC wallet on Base first."));
  return ok({
    id: props.id,
    kind: "creator",
    sellerId: null,
    orderId: null,
    accountId: props.accountId,
    amount: props.amount,
    address: props.address,
    status: "requested",
    txHash: null,
    note: null,
    requestedAt: props.at,
    decidedAt: null,
    decidedBy: null,
  });
}

export function requestRefund(props: { id: string; orderId: string; sellerId: string; accountId: string; amount: Cents; address: string | null; at: Date }): Disbursement {
  return {
    id: props.id,
    kind: "refund",
    sellerId: props.sellerId,
    orderId: props.orderId,
    accountId: props.accountId,
    amount: props.amount,
    address: props.address,
    status: "requested",
    txHash: null,
    note: null,
    requestedAt: props.at,
    decidedAt: null,
    decidedBy: null,
  };
}

/** Recorded after the transfer is made from the treasury wallet. */
export function markSent(d: Disbursement, input: { txHash: string; address: string | null }, by: string, at: Date): Result<Disbursement, DisbursementError> {
  if (d.status !== "requested") return err(domainError("not_requested", "This one is already settled."));
  const address = d.address ?? input.address?.trim() ?? null;
  if (!address || !EVM_ADDRESS.test(address)) return err(domainError("invalid_address", "Add the address it was sent to."));
  const txHash = input.txHash.trim();
  if (!EVM_TX.test(txHash)) return err(domainError("invalid_tx", "Paste the transaction hash (0x and 64 characters)."));
  return ok({ ...d, address, status: "sent", txHash, decidedAt: at, decidedBy: by });
}

/** Only payouts can be cancelled (the money goes back to the balance); refunds are owed. */
export function cancelPayout(d: Disbursement, note: string, by: string, at: Date): Result<Disbursement, DisbursementError> {
  if (d.status !== "requested" || d.kind === "refund") return err(domainError("not_requested", "Only requested payouts can be cancelled."));
  const n = note.trim();
  if (n.length < 5) return err(domainError("invalid_note", "Say why, so they can fix it."));
  return ok({ ...d, status: "cancelled", note: n, decidedAt: at, decidedBy: by });
}

export type DisbursementSent = Readonly<{ type: "DisbursementSent"; disbursementId: string; kind: DisbursementKind; sellerId: string | null; accountId: string | null; amount: Cents; txHash: string; at: Date }>;
