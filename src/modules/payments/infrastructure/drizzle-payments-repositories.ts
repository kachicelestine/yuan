import { eq, sum } from "drizzle-orm";
import type { Database } from "@/shared/infrastructure/database";
import { cents } from "@/shared/kernel/money";
import type { Invoice } from "../domain/invoice";
import type { Journal } from "../domain/ledger";
import type { InvoiceRepository, Ledger } from "../domain/ports";
import type { RailId } from "../domain/rails";
import { invoices, journals, ledgerEntries } from "./schema";

const toInvoice = (r: typeof invoices.$inferSelect): Invoice => ({
  id: r.id,
  orderId: r.orderId,
  rail: r.rail as RailId,
  amount: cents(r.amountCents),
  units: r.units,
  payTo: r.payTo,
  status: r.status,
  createdAt: r.createdAt,
  expiresAt: r.expiresAt,
  paidAt: r.paidAt,
  txHash: r.txHash,
  late: r.late,
});

export class DrizzleInvoiceRepository implements InvoiceRepository {
  constructor(private readonly db: Database) {}

  async findById(id: string) {
    const [r] = await this.db.select().from(invoices).where(eq(invoices.id, id)).limit(1);
    return r ? toInvoice(r) : null;
  }

  async findByOrder(orderId: string) {
    const [r] = await this.db.select().from(invoices).where(eq(invoices.orderId, orderId)).limit(1);
    return r ? toInvoice(r) : null;
  }

  async save(i: Invoice) {
    const row = {
      id: i.id,
      orderId: i.orderId,
      rail: i.rail,
      amountCents: i.amount,
      units: i.units,
      payTo: i.payTo,
      status: i.status,
      createdAt: i.createdAt,
      expiresAt: i.expiresAt,
      paidAt: i.paidAt,
      txHash: i.txHash,
      late: i.late,
    };
    await this.db
      .insert(invoices)
      .values(row)
      .onConflictDoUpdate({ target: invoices.id, set: { status: row.status, paidAt: row.paidAt, txHash: row.txHash, late: row.late } });
  }
}

export class DrizzleLedger implements Ledger {
  constructor(private readonly db: Database) {}

  /** Writes a journal and its entries. A journal's reference is unique, so posting twice fails loudly. */
  async post(j: Journal) {
    await this.db.insert(journals).values({ id: j.id, reference: j.reference, memo: j.memo, at: j.at });
    await this.db.insert(ledgerEntries).values(j.entries.map((e) => ({ journalId: j.id, account: e.account, amountCents: e.amount })));
  }

  /** An account's balance in cents. */
  async balance(account: string) {
    const [r] = await this.db.select({ total: sum(ledgerEntries.amountCents) }).from(ledgerEntries).where(eq(ledgerEntries.account, account));
    return Number(r?.total ?? 0);
  }
}
