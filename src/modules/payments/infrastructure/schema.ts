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
    orderId: uuid().notNull().unique(),
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
