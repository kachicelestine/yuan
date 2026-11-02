import { domainError, err, ok, type Cents, type Clock, type DomainError, type EventLog, type Result } from "@/shared/kernel";
import { confirmPayment, expire, formatUnits, MAX_AD_CREDIT, MIN_AD_CREDIT, openInvoice, type Invoice, type InvoiceExpired, type InvoiceStatus } from "../domain/invoice";
import { adCreditBought, paymentReceived } from "../domain/ledger";
import type { InvoiceRepository, Ledger, PaymentNetwork } from "../domain/ports";
import { isRailId, RAILS } from "../domain/rails";

export type InvoiceView = {
  id: string;
  orderId: string;
  /** The shop buying ad credit, when this isn't paying an order. */
  adSellerId: string | null;
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
    adSellerId: i.adSellerId,
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
  return async (req: { orderId: string; adSellerId?: string; amount: Cents; rail: string }): Promise<Result<{ invoiceId: string }, DomainError<"rail_unavailable" | "invalid_amount">>> => {
    if (!isRailId(req.rail) || !deps.network.rails.includes(req.rail)) {
      return err(domainError("rail_unavailable", `Payments on ${req.rail} aren't available right now.`));
    }
    const opened = openInvoice({ id: deps.newId(), orderId: req.orderId, adSellerId: req.adSellerId, rail: req.rail, amount: req.amount, payTo: deps.network.payTo(req.rail), tag: deps.newTag(), at: deps.clock.now() });
    if (!opened.ok) return err(domainError("invalid_amount", opened.error.message));
    await deps.invoices.save(opened.value);
    return ok({ invoiceId: opened.value.id });
  };
}

/** A shop's owner buys ad credit: an invoice with no order behind it, settled into the shop's credit. */
export function makeBuyAdCredit(deps: { request: ReturnType<typeof makeRequestPayment>; newId: () => string }) {
  return async (req: { sellerId: string; amount: Cents; rail: string }) => {
    if (req.amount < MIN_AD_CREDIT || req.amount > MAX_AD_CREDIT) return err(domainError("invalid_amount", `Add between $${MIN_AD_CREDIT / 100} and $${MAX_AD_CREDIT / 100} at a time.`));
    return deps.request({ orderId: deps.newId(), adSellerId: req.sellerId, amount: req.amount, rail: req.rail });
  };
}

export type SettlementScope = {
  invoices: InvoiceRepository;
  ledger: Ledger;
  events: EventLog;
  /** Tells the order its payment arrived (implemented by the ordering module). */
  orderPaid: (orderId: string, at: Date) => Promise<Result<unknown, DomainError>>;
  /** Tells the order its payment window closed unpaid. */
  orderLapsed: (orderId: string) => Promise<Result<unknown, DomainError>>;
};

/**
 * The background sweep: checks every open invoice (and recently expired ones, to catch
 * late payments) so orders settle and lapse even when nobody has the pay page open.
 */
export function makeSyncInvoices(deps: { invoices: Pick<InvoiceRepository, "idsToSync">; checkInvoice: (id: string) => Promise<InvoiceView | null>; clock: Clock }) {
  return async (limit = 200): Promise<{ checked: number; paid: number; expired: number }> => {
    const since = new Date(deps.clock.now().getTime() - LATE_PAYMENT_WINDOW_MS);
    const ids = await deps.invoices.idsToSync(since, limit);
    let paid = 0;
    let expired = 0;
    for (const id of ids) {
      const view = await deps.checkInvoice(id);
      if (view?.status === "paid") paid++;
      if (view?.status === "expired") expired++;
    }
    return { checked: ids.length, paid, expired };
  };
}

/** How long after expiry a payment is still looked for (and accepted, marked late). */
export const LATE_PAYMENT_WINDOW_MS = 24 * 60 * 60 * 1000;

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
        await deps.uow.run(async ({ invoices, ledger, events, orderPaid }) => {
          await invoices.save(paid);
          await events.record(paid.id, event);
          const entry = paid.adSellerId
            ? adCreditBought({ id: deps.newId(), invoiceId: paid.id, sellerId: paid.adSellerId, rail: paid.rail, amount: paid.amount, at: event.at })
            : paymentReceived({ id: deps.newId(), invoiceId: paid.id, orderId: paid.orderId, rail: paid.rail, amount: paid.amount, at: event.at });
          if (!entry.ok) throw new Error(entry.error.message);
          await ledger.post(entry.value);
          if (paid.adSellerId) return;
          const r = await orderPaid(paid.orderId, event.at);
          if (!r.ok) throw new Error(r.error.message);
        });
      }
      return toInvoiceView(paid, deps.network);
    }

    if (invoice.status === "pending") {
      const r = expire(invoice, deps.clock.now());
      if (r.ok && r.value.status === "expired") {
        await deps.uow.run(async ({ invoices, events, orderLapsed }) => {
          await invoices.save(r.value);
          const expired: InvoiceExpired = { type: "InvoiceExpired", invoiceId: r.value.id, orderId: r.value.orderId, at: deps.clock.now() };
          await events.record(r.value.id, expired);
          if (r.value.adSellerId) return;
          const lapsed = await orderLapsed(r.value.orderId);
          if (!lapsed.ok) throw new Error(lapsed.error.message);
        });
        return toInvoiceView(r.value, deps.network);
      }
    }
    return toInvoiceView(invoice, deps.network);
  };
}
