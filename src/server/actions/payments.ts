"use server";

import { z } from "zod";
import { services } from "../container";
import { ownInvoice } from "../invoices";
import { currentAccount } from "../session";

/** Development only: marks one of your own invoices as paid on the simulated network. */
export async function simulatePaymentAction(invoiceId: string): Promise<boolean> {
  const id = z.uuid().safeParse(invoiceId);
  const app = await services();
  const account = await currentAccount();
  if (!id.success || !app.simulatePayment || !account || !(await ownInvoice(id.data, account.id))) return false;
  const sent = await app.simulatePayment(id.data);
  if (sent) await app.checkInvoice(id.data);
  return sent;
}
