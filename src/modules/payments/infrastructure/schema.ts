import { sql } from "drizzle-orm";
import { bigint, boolean, check, index, integer, pgSchema, serial, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { RAILS } from "../domain/rails";

export const paymentsSchema = pgSchema("payments");

export const railEnum = paymentsSchema.enum(
  "rail",
  RAILS.map((r) => r.id) as [string, ...string[]],
);
export const invoiceStatus = paymentsSchema.enum("invoice_status", ["pending", "paid", "expired"]);

export const invoices = paymentsSchema.table(
  "invoices",
  {
    id: uuid().primaryKey(),
    /** The order this pays, or for ad credit this purchase's own id. */
    orderId: uuid().notNull().unique(),
    /** The shop buying ad credit; null for an order. */
    adSellerId: text(),
    rail: railEnum().notNull(),
    amountCents: integer().notNull(),
    /** Token base units (6 decimals); bigint because a large order exceeds 2^31. */
    units: bigint({ mode: "bigint" }).notNull(),
    payTo: text().notNull(),
    status: invoiceStatus().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull(),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    paidAt: timestamp({ withTimezone: true }),
    txHash: text().unique(),
    late: boolean().notNull().default(false),
  },
  (t) => [
    // Two open invoices must never ask for the same amount at the same address,
    // or one transfer could settle either. The tag makes this rare; this makes it impossible.
    uniqueIndex("invoices_open_amount_uq").on(t.payTo, t.units).where(sql`${t.status} = 'pending'`),
    index("invoices_status_idx").on(t.status, t.expiresAt),
    check("invoices_amount_positive", sql`${t.amountCents} > 0`),
  ],
);

export const journals = paymentsSchema.table("journals", {
  id: uuid().primaryKey(),
  /** What caused it, e.g. invoice:<id>; one journal per cause keeps posting idempotent. */
  reference: text().notNull().unique(),
  memo: text().notNull(),
  at: timestamp({ withTimezone: true }).notNull(),
});

export const ledgerEntries = paymentsSchema.table(
  "ledger_entries",
  {
    id: serial().primaryKey(),
    journalId: uuid()
      .notNull()
      .references(() => journals.id),
    account: text().notNull(),
    amountCents: bigint({ mode: "number" }).notNull(),
  },
  (t) => [index("ledger_entries_account_idx").on(t.account)],
);

/** Development only: transfers "sent" with the simulate button. */
export const simulatedTransfers = paymentsSchema.table("simulated_transfers", {
  invoiceId: uuid().primaryKey(),
  units: bigint({ mode: "bigint" }).notNull(),
  txHash: text().notNull(),
  at: timestamp({ withTimezone: true }).notNull(),
});

export const disbursementKind = paymentsSchema.enum("disbursement_kind", ["payout", "refund", "creator"]);
export const disbursementStatus = paymentsSchema.enum("disbursement_status", ["requested", "sent", "cancelled"]);

/** Payouts to shops and refunds to buyers, sent from the treasury by a person for now. */
export const disbursements = paymentsSchema.table(
  "disbursements",
  {
    id: uuid().primaryKey(),
    kind: disbursementKind().notNull(),
    sellerId: text(),
    orderId: uuid(),
    accountId: uuid(),
    amountCents: bigint({ mode: "number" }).notNull(),
    address: text(),
    status: disbursementStatus().notNull(),
    txHash: text(),
    note: text(),
    requestedAt: timestamp({ withTimezone: true }).notNull(),
    decidedAt: timestamp({ withTimezone: true }),
    decidedBy: uuid(),
  },
  (t) => [
    index("disbursements_pending_idx").on(t.requestedAt).where(sql`${t.status} = 'requested'`),
    index("disbursements_seller_idx").on(t.sellerId, t.requestedAt),
    index("disbursements_account_idx").on(t.accountId, t.requestedAt),
    // Compared as text: a migration can't use an enum value it adds in the same transaction.
    check("disbursements_payee", sql`(${t.kind}::text = 'creator' and ${t.accountId} is not null) or (${t.kind}::text <> 'creator' and ${t.sellerId} is not null)`),
    // One refund per shop per order, however often the event is delivered.
    uniqueIndex("disbursements_refund_uq").on(t.orderId, t.sellerId).where(sql`${t.kind} = 'refund'`),
    uniqueIndex("disbursements_tx_uq").on(t.txHash),
    check("disbursements_amount", sql`${t.amountCents} > 0`),
  ],
);
