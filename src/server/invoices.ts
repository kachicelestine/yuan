import "server-only";
import type { InvoiceView } from "@/modules/payments";
import { services } from "./container";

/**
 * An invoice, synced with the chain, if it belongs to an order this account placed.
 * Anyone else gets null, the same as for an invoice that doesn't exist.
 */
export async function ownInvoice(invoiceId: string, accountId: string): Promise<{ invoice: InvoiceView; orderNumber: string } | null> {
  const app = await services();
  const invoice = await app.checkInvoice(invoiceId);
  if (!invoice) return null;
  const order = await app.getOrder.byId(invoice.orderId, accountId);
  return order ? { invoice, orderNumber: order.number } : null;
}
