import { domainError, err, ok, type Cents, type Clock, type DomainError, type Result } from "@/shared/kernel";
import { confirmPayment, expire, formatUnits, openInvoice, type Invoice, type InvoiceStatus } from "../domain/invoice";
import { paymentReceived } from "../domain/ledger";
import type { InvoiceRepository, Ledger, PaymentNetwork } from "../domain/ports";
import { isRailId, RAILS } from "../domain/rails";

export type InvoiceView = {
  id: string;
  orderId: string;
  status: InvoiceStatus;
  rail: string;
  asset: string;
  network: string;
  /** Order total in US dollars. */
  amount: number;
  /** Exact token amount to send, e.g. "87.400123". */
  exactAmount: string;
  payTo: string;
  /** Wallet deep link (EIP-681 / Solana Pay), when the network has one. */
  paymentUri: string | null;
  expiresAt: string;
  paidAt: string | null;
  txHash: string | null;
  late: boolean;
  /** True when no real chain is involved (development). */
  simulated: boolean;
};

export function toInvoiceView(i: Invoice, network: Pick<PaymentNetwork, "paymentUri" | "simulated">): InvoiceView {
  const rail = RAILS.find((r) => r.id === i.rail)!;
  return {
    id: i.id,
    orderId: i.orderId,
    status: i.status,
    rail: i.rail,
    asset: rail.asset,
    network: rail.network,
    amount: i.amount / 100,
    exactAmount: formatUnits(i.units),
    payTo: i.payTo,
    paymentUri: network.paymentUri(i),
    expiresAt: i.expiresAt.toISOString(),
    paidAt: i.paidAt?.toISOString() ?? null,
    txHash: i.txHash,
    late: i.late,
    simulated: network.simulated,
  };
}

/** Opens the invoice for an order on the rail the buyer picked. */
export function makeRequestPayment(deps: { network: PaymentNetwork; invoices: InvoiceRepository; clock: Clock; newId: () => string; newTag: () => number }) {
  return async (req: { orderId: string; amount: Cents; rail: string }): Promise<Result<{ invoiceId: string }, DomainError<"rail_unavailable" | "invalid_amount">>> => {
    if (!isRailId(req.rail) || !deps.network.rails.includes(req.rail)) {
      return err(domainError("rail_unavailable", `Payments on ${req.rail} aren't available right now.`));
    }
    const opened = openInvoice({ id: deps.newId(), orderId: req.orderId, rail: req.rail, amount: req.amount, payTo: deps.network.payTo(req.rail), tag: deps.newTag(), at: deps.clock.now() });
    if (!opened.ok) return err(domainError("invalid_amount", opened.error.message));
    await deps.invoices.save(opened.value);
    return ok({ invoiceId: opened.value.id });
  };
}

export type SettlementScope = {
  invoices: InvoiceRepository;
  ledger: Ledger;
  /** Tells the order its payment arrived (implemented by the ordering module). */
  orderPaid: (orderId: string, at: Date) => Promise<Result<unknown, DomainError>>;
  /** Tells the order its payment window closed unpaid. */
  orderLapsed: (orderId: string) => Promise<Result<unknown, DomainError>>;
};

/**
 * Syncs an invoice with the chain: if a matching transfer has landed, the invoice is
 * marked paid, the funds are posted to the order's escrow, and the order is told; all
 * in one transaction. Unpaid invoices past their window are closed. Safe to call often.
 */
export function makeCheckInvoice(deps: {
  network: PaymentNetwork;
  invoices: InvoiceRepository;
  uow: { run<T>(work: (scope: SettlementScope) => Promise<T>): Promise<T> };
  clock: Clock;
  newId: () => string;
}) {
  return async (invoiceId: string): Promise<InvoiceView | null> => {
    const invoice = await deps.invoices.findById(invoiceId);
    if (!invoice) return null;
    if (invoice.status === "paid") return toInvoiceView(invoice, deps.network);

    const transfer = await deps.network.findTransfer(invoice);
    if (transfer) {
      const confirmed = confirmPayment(invoice, transfer);
      if (!confirmed.ok) return toInvoiceView(invoice, deps.network); // underpaid: keep waiting
      const { invoice: paid, event } = confirmed.value;
      if (event) {
        await deps.uow.run(async ({ invoices, ledger, orderPaid }) => {
          await invoices.save(paid);
          const entry = paymentReceived({ id: deps.newId(), invoiceId: paid.id, orderId: paid.orderId, rail: paid.rail, amount: paid.amount, at: event.at });
          if (!entry.ok) throw new Error(entry.error.message);
          await ledger.post(entry.value);
          const r = await orderPaid(paid.orderId, event.at);
          if (!r.ok) throw new Error(r.error.message);
        });
      }
      return toInvoiceView(paid, deps.network);
    }

    if (invoice.status === "pending") {
      const r = expire(invoice, deps.clock.now());
      if (r.ok && r.value.status === "expired") {
        await deps.uow.run(async ({ invoices, orderLapsed }) => {
          await invoices.save(r.value);
          const lapsed = await orderLapsed(r.value.orderId);
          if (!lapsed.ok) throw new Error(lapsed.error.message);
        });
        return toInvoiceView(r.value, deps.network);
      }
    }
    return toInvoiceView(invoice, deps.network);
  };
}
