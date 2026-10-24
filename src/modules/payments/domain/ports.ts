import type { Disbursement } from "./disbursement";
import type { Invoice, Transfer } from "./invoice";
import type { Journal } from "./ledger";
import type { RailId } from "./rails";

export interface InvoiceRepository {
  findById(id: string): Promise<Invoice | null>;
  findByOrder(orderId: string): Promise<Invoice | null>;
  save(invoice: Invoice): Promise<void>;
  /** Invoice ids worth checking against the chain: every pending one, plus ones that expired after `expiredSince` (late payments). */
  idsToSync(expiredSince: Date, limit: number): Promise<string[]>;
}

export interface Ledger {
  post(journal: Journal): Promise<void>;
  /** Posts unless a journal with the same reference exists (event handlers run at least once). */
  postOnce(journal: Journal): Promise<boolean>;
  balance(account: string): Promise<number>;
}

export interface DisbursementRepository {
  find(id: string): Promise<Disbursement | null>;
  save(d: Disbursement): Promise<void>;
  /** The refund for one shop's parcel in an order, if any. */
  findRefund(orderId: string, sellerId: string): Promise<Disbursement | null>;
  /** Waiting to be sent, oldest first. */
  pending(limit: number): Promise<Disbursement[]>;
  /** True when a transfer with this hash is already recorded (each one can be used once). */
  txRecorded(txHash: string): Promise<boolean>;
  /** A shop's payouts, newest first. */
  payoutsFor(sellerId: string, limit: number): Promise<Disbursement[]>;
}

/**
 * A blockchain (or a simulation of one). Tells the app where buyers should send funds
 * and whether a matching transfer has arrived.
 */
export interface PaymentNetwork {
  /** Rails this network can take payments on right now. */
  readonly rails: readonly RailId[];
  /** The address buyers pay on a rail. */
  payTo(rail: RailId): string;
  /** A transfer of exactly the invoice's amount to its address, if one has landed. */
  findTransfer(invoice: Invoice): Promise<Transfer | null>;
  /** A wallet deep link that pre-fills the transfer (EIP-681, Solana Pay), if the rail has one. */
  paymentUri(invoice: Invoice): string | null;
  /** True for the development simulation, where no real funds move. */
  readonly simulated: boolean;
}
