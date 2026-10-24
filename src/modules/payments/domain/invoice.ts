import { domainError, err, ok, type Cents, type DomainError, type Result } from "@/shared/kernel";
import type { RailId } from "./rails";

/** USDC and USDT both use 6 decimals: one cent is 10,000 base units. */
export const UNITS_PER_CENT = 10_000;
export const INVOICE_TTL_MS = 30 * 60_000;

export type InvoiceStatus = "pending" | "paid" | "expired";

/** An on-chain transfer that paid an invoice. */
export type Transfer = Readonly<{ txHash: string; units: bigint; at: Date }>;

export type Invoice = Readonly<{
  id: string;
  orderId: string;
  rail: RailId;
  /** The order total. */
  amount: Cents;
  /**
   * Exact token amount to send, in base units: the total plus a tag below one cent
   * (1–9,999 units) that tells apart invoices paying the same treasury address.
   */
  units: bigint;
  payTo: string;
  status: InvoiceStatus;
  createdAt: Date;
  expiresAt: Date;
  paidAt: Date | null;
  txHash: string | null;
  /** Paid after the window closed; accepted, and flagged for review. */
  late: boolean;
}>;

export type InvoicePaid = Readonly<{ type: "InvoicePaid"; invoiceId: string; orderId: string; amount: Cents; rail: RailId; txHash: string; at: Date }>;
export type InvoiceExpired = Readonly<{ type: "InvoiceExpired"; invoiceId: string; orderId: string; at: Date }>;

export type InvoiceError = DomainError<"invalid_amount" | "underpaid" | "invoice_closed">;

/** "87.400123": the units as a decimal token amount, for display and wallet links. */
export function formatUnits(units: bigint, decimals = 6) {
  const s = units.toString().padStart(decimals + 1, "0");
  return `${s.slice(0, -decimals)}.${s.slice(-decimals)}`;
}

export function openInvoice(props: { id: string; orderId: string; rail: RailId; amount: Cents; payTo: string; tag: number; at: Date }): Result<Invoice, InvoiceError> {
  if (props.amount <= 0) return err(domainError("invalid_amount", "There is nothing to pay."));
  if (!Number.isInteger(props.tag) || props.tag < 1 || props.tag >= UNITS_PER_CENT) return err(domainError("invalid_amount", "Invoice tag must be 1–9,999."));
  return ok({
    id: props.id,
    orderId: props.orderId,
    rail: props.rail,
    amount: props.amount,
    units: BigInt(props.amount) * BigInt(UNITS_PER_CENT) + BigInt(props.tag),
    payTo: props.payTo,
    status: "pending",
    createdAt: props.at,
    expiresAt: new Date(props.at.getTime() + INVOICE_TTL_MS),
    paidAt: null,
    txHash: null,
    late: false,
  });
}

/**
 * Records the transfer that paid the invoice. Overpaying is accepted (the extra is
 * refundable), underpaying is not. A payment that lands after expiry still counts:
 * the buyer's money arrived, so we keep the order and flag it.
 */
export function confirmPayment(invoice: Invoice, transfer: Transfer): Result<{ invoice: Invoice; event: InvoicePaid | null }, InvoiceError> {
  if (invoice.status === "paid") return ok({ invoice, event: null });
  if (transfer.units < invoice.units) return err(domainError("underpaid", `Received ${formatUnits(transfer.units)}, expected ${formatUnits(invoice.units)}.`));
  const paid: Invoice = { ...invoice, status: "paid", paidAt: transfer.at, txHash: transfer.txHash, late: transfer.at > invoice.expiresAt };
  return ok({
    invoice: paid,
    event: { type: "InvoicePaid", invoiceId: paid.id, orderId: paid.orderId, amount: paid.amount, rail: paid.rail, txHash: transfer.txHash, at: transfer.at },
  });
}

/** Closes an unpaid invoice whose window has passed. */
export function expire(invoice: Invoice, now: Date): Result<Invoice, InvoiceError> {
  if (invoice.status !== "pending") return err(domainError("invoice_closed", `Invoice is already ${invoice.status}.`));
  if (now < invoice.expiresAt) return ok(invoice);
  return ok({ ...invoice, status: "expired" });
}
