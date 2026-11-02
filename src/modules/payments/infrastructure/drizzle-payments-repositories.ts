import { and, asc, desc, eq, gt, or, sum } from "drizzle-orm";
import type { Database } from "@/shared/infrastructure/database";
import { cents } from "@/shared/kernel/money";
import type { Disbursement } from "../domain/disbursement";
import type { Invoice } from "../domain/invoice";
import type { Journal } from "../domain/ledger";
import type { DisbursementRepository, InvoiceRepository, Ledger } from "../domain/ports";
import type { RailId } from "../domain/rails";
import { disbursements, invoices, journals, ledgerEntries } from "./schema";

const toInvoice = (r: typeof invoices.$inferSelect): Invoice => ({
  id: r.id,
  orderId: r.orderId,
  adSellerId: r.adSellerId,
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

  async idsToSync(expiredSince: Date, limit: number) {
    const rows = await this.db
      .select({ id: invoices.id })
      .from(invoices)
      .where(or(eq(invoices.status, "pending"), and(eq(invoices.status, "expired"), gt(invoices.expiresAt, expiredSince))))
      .orderBy(asc(invoices.expiresAt))
      .limit(limit);
    return rows.map((r) => r.id);
  }

  async save(i: Invoice) {
    const row = {
      id: i.id,
      orderId: i.orderId,
      adSellerId: i.adSellerId,
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

  async postOnce(j: Journal) {
    const inserted = await this.db
      .insert(journals)
      .values({ id: j.id, reference: j.reference, memo: j.memo, at: j.at })
      .onConflictDoNothing({ target: journals.reference })
      .returning({ id: journals.id });
    if (!inserted.length) return false;
    await this.db.insert(ledgerEntries).values(j.entries.map((e) => ({ journalId: j.id, account: e.account, amountCents: e.amount })));
    return true;
  }

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

const toDisbursement = (r: typeof disbursements.$inferSelect): Disbursement => ({
  id: r.id,
  kind: r.kind,
  sellerId: r.sellerId,
  orderId: r.orderId,
  accountId: r.accountId,
  amount: cents(r.amountCents),
  address: r.address,
  status: r.status,
  txHash: r.txHash,
  note: r.note,
  requestedAt: r.requestedAt,
  decidedAt: r.decidedAt,
  decidedBy: r.decidedBy,
});

export class DrizzleDisbursementRepository implements DisbursementRepository {
  constructor(private readonly db: Database) {}

  async find(id: string) {
    const [r] = await this.db.select().from(disbursements).where(eq(disbursements.id, id)).limit(1);
    return r ? toDisbursement(r) : null;
  }

  async save(d: Disbursement) {
    const values = {
      id: d.id,
      kind: d.kind,
      sellerId: d.sellerId,
      orderId: d.orderId,
      accountId: d.accountId,
      amountCents: d.amount,
      address: d.address,
      status: d.status,
      txHash: d.txHash,
      note: d.note,
      requestedAt: d.requestedAt,
      decidedAt: d.decidedAt,
      decidedBy: d.decidedBy,
    };
    await this.db.insert(disbursements).values(values).onConflictDoUpdate({ target: disbursements.id, set: values });
  }

  async findRefund(orderId: string, sellerId: string) {
    const [r] = await this.db
      .select()
      .from(disbursements)
      .where(and(eq(disbursements.kind, "refund"), eq(disbursements.orderId, orderId), eq(disbursements.sellerId, sellerId)))
      .limit(1);
    return r ? toDisbursement(r) : null;
  }

  async txRecorded(txHash: string) {
    return (await this.db.select({ id: disbursements.id }).from(disbursements).where(eq(disbursements.txHash, txHash)).limit(1)).length > 0;
  }

  async pending(limit: number) {
    return (await this.db.select().from(disbursements).where(eq(disbursements.status, "requested")).orderBy(asc(disbursements.requestedAt)).limit(limit)).map(toDisbursement);
  }

  async creatorPayoutsFor(accountId: string, limit: number) {
    return (
      await this.db
        .select()
        .from(disbursements)
        .where(and(eq(disbursements.kind, "creator"), eq(disbursements.accountId, accountId)))
        .orderBy(desc(disbursements.requestedAt))
        .limit(limit)
    ).map(toDisbursement);
  }

  async payoutsFor(sellerId: string, limit: number) {
    return (
      await this.db
        .select()
        .from(disbursements)
        .where(and(eq(disbursements.kind, "payout"), eq(disbursements.sellerId, sellerId)))
        .orderBy(desc(disbursements.requestedAt))
        .limit(limit)
    ).map(toDisbursement);
  }
}
