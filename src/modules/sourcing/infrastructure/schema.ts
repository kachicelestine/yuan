import { boolean, check, index, integer, pgSchema, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const sourcingSchema = pgSchema("sourcing");

export const incoterm = sourcingSchema.enum("incoterm", ["FOB", "CIF", "DDP"]);
export const rfqStatus = sourcingSchema.enum("rfq_status", ["open", "ordered", "closed"]);
export const quoteStatus = sourcingSchema.enum("quote_status", ["offered", "accepted", "withdrawn", "declined"]);

/** Requests for quotes: what a buyer needs, sent to a few matching shops. */
export const rfqs = sourcingSchema.table(
  "rfqs",
  {
    id: text().primaryKey(),
    buyerId: uuid().notNull(),
    buyerName: text().notNull(),
    item: text().notNull(),
    details: text().notNull(),
    slug: text(),
    qty: integer().notNull(),
    targetCents: integer(),
    port: text().notNull(),
    incoterm: incoterm().notNull(),
    samples: boolean().notNull(),
    sellerIds: text().array().notNull(),
    status: rfqStatus().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull(),
    closesAt: timestamp({ withTimezone: true }).notNull(),
  },
  (t) => [
    index("rfqs_buyer_idx").on(t.buyerId, t.createdAt),
    index("rfqs_sellers_idx").using("gin", t.sellerIds),
    index("rfqs_open_idx").on(t.closesAt).where(sql`${t.status} = 'open'`),
    check("rfqs_qty", sql`${t.qty} between 1 and 10000`),
  ],
);

/** One quote per shop per request. */
export const quotes = sourcingSchema.table(
  "quotes",
  {
    id: uuid().primaryKey(),
    rfqId: text().notNull(),
    sellerId: text().notNull(),
    slug: text().notNull(),
    unitPriceCents: integer().notNull(),
    moq: integer().notNull(),
    leadDays: integer().notNull(),
    sampleCents: integer(),
    note: text().notNull(),
    status: quoteStatus().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull(),
    updatedAt: timestamp({ withTimezone: true }).notNull(),
    holdUntil: timestamp({ withTimezone: true }),
    usedAt: timestamp({ withTimezone: true }),
  },
  (t) => [uniqueIndex("quotes_rfq_seller_uq").on(t.rfqId, t.sellerId), index("quotes_slug_idx").on(t.slug).where(sql`${t.status} = 'accepted'`), check("quotes_price", sql`${t.unitPriceCents} > 0`)],
);
