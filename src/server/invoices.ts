import "server-only";
import type { InvoiceView } from "@/modules/payments";
import { services } from "./container";

/**
 * An invoice, synced with the chain, if it belongs to an order this account placed or to
 * ad credit for a shop it owns. Anyone else gets null, the same as for an invoice that doesn't exist.
 */
export async function ownInvoice(invoiceId: string, accountId: string): Promise<{ invoice: InvoiceView; orderNumber: string | null } | null> {
  const app = await services();
  const invoice = await app.checkInvoice(invoiceId);
  if (!invoice) return null;
  if (invoice.adSellerId) {
    const shops = await app.onboarding.memberships(accountId);
    return shops.some((s) => s.sellerId === invoice.adSellerId && s.role === "owner") ? { invoice, orderNumber: null } : null;
  }
  const order = await app.getOrder.byId(invoice.orderId, accountId);
  return order ? { invoice, orderNumber: order.number } : null;
}
