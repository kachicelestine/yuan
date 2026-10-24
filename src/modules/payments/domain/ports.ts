import type { Invoice, Transfer } from "./invoice";
import type { Journal } from "./ledger";
import type { RailId } from "./rails";

export interface InvoiceRepository {
  findById(id: string): Promise<Invoice | null>;
  findByOrder(orderId: string): Promise<Invoice | null>;
  save(invoice: Invoice): Promise<void>;
}

export interface Ledger {
  post(journal: Journal): Promise<void>;
  balance(account: string): Promise<number>;
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
