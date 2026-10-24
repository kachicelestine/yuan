import { sql } from "drizzle-orm";
import { index, jsonb, pgSchema, primaryKey, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import type { BusinessDetails, KycDocument } from "../domain/application";

export const merchantsSchema = pgSchema("merchants");

export const applicationStatus = merchantsSchema.enum("application_status", ["draft", "submitted", "approved", "rejected"]);
export const memberRole = merchantsSchema.enum("member_role", ["owner", "staff"]);

/** Stored document: the upload time as ISO text inside JSON. */
export type StoredDocument = Omit<KycDocument, "uploadedAt"> & { uploadedAt: string };

export const applications = merchantsSchema.table(
  "applications",
  {
    id: uuid().primaryKey(),
    accountId: uuid().notNull(),
    status: applicationStatus().notNull(),
    business: jsonb().$type<BusinessDetails>(),
    /** Copied out of `business` so a shop address can be claimed by one application only. */
    handle: text(),
    payoutWallet: text(),
    documents: jsonb().$type<StoredDocument[]>().notNull().default([]),
    createdAt: timestamp({ withTimezone: true }).notNull(),
    submittedAt: timestamp({ withTimezone: true }),
    decidedAt: timestamp({ withTimezone: true }),
    decidedBy: uuid(),
    decisionNote: text(),
    sellerId: text(),
  },
  (t) => [
    index("applications_account_idx").on(t.accountId, t.createdAt),
    index("applications_queue_idx").on(t.status, t.submittedAt),
    uniqueIndex("applications_handle_uq").on(t.handle).where(sql`${t.status} <> 'rejected'`),
  ],
);

export const members = merchantsSchema.table(
  "members",
  {
    sellerId: text().notNull(),
    accountId: uuid().notNull(),
    role: memberRole().notNull(),
    since: timestamp({ withTimezone: true }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.sellerId, t.accountId] }), index("members_account_idx").on(t.accountId)],
);
