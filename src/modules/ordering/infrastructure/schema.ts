import { sql } from "drizzle-orm";
import { char, check, index, integer, jsonb, pgSchema, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type { ShippingAddress } from "../domain/address";
import { ORDER_STATUSES } from "../domain/order";
import { DISPUTE_REASONS, SHIPMENT_STATUSES } from "../domain/shipment";
import { SHIPPING_METHODS } from "../domain/pricing";

export const orderingSchema = pgSchema("ordering");

export const orderStatus = orderingSchema.enum("order_status", ORDER_STATUSES);
export const shippingMethod = orderingSchema.enum("shipping_method", SHIPPING_METHODS);

export const orders = orderingSchema.table(
  "orders",
  {
    id: uuid().primaryKey(),
    number: text().notNull().unique(),
    buyerId: uuid().notNull(),
    status: orderStatus().notNull(),
    country: char({ length: 2 }).notNull(),
    /** Delivery address; null on orders placed before addresses were taken. */
    address: jsonb().$type<ShippingAddress>(),
    shippingMethod: shippingMethod().notNull(),
    subtotalCents: integer().notNull(),
    discountCents: integer().notNull(),
    shippingCents: integer().notNull(),
    dutyCents: integer().notNull(),
    vatCents: integer().notNull(),
    dueAtDoorCents: integer().notNull(),
    totalCents: integer().notNull(),
    parcels: integer().notNull(),
    couponId: text(),
    /** Creator code the buyer arrived through. */
    referral: text(),
    placedAt: timestamp({ withTimezone: true }).notNull(),
    paidAt: timestamp({ withTimezone: true }),
  },
  (t) => [index("orders_placed_idx").on(t.placedAt), index("orders_buyer_idx").on(t.buyerId, t.placedAt), check("orders_total_non_negative", sql`${t.totalCents} >= 0`)],
);

/** A signed-in buyer's bag. Option "" means the defaults (part of the key, so not null). */
export const cartItems = orderingSchema.table(
  "cart_items",
  {
    buyerId: uuid().notNull(),
    slug: text().notNull(),
    option: text().notNull().default(""),
    qty: integer().notNull(),
    note: text(),
    position: integer().notNull(),
  },
  (t) => [primaryKey({ columns: [t.buyerId, t.slug, t.option] }), check("cart_items_qty", sql`${t.qty} >= 1`)],
);

/** What was bought, frozen at checkout; catalog edits never change it. */
export const orderLines = orderingSchema.table(
  "order_lines",
  {
    orderId: uuid()
      .notNull()
      .references(() => orders.id, { onDelete: "cascade" }),
    position: integer().notNull(),
    productId: uuid().notNull(),
    slug: text().notNull(),
    title: text().notNull(),
    image: text().notNull(),
    sellerId: text().notNull(),
    option: text(),
    unitPriceCents: integer().notNull(),
    qty: integer().notNull(),
  },
  (t) => [primaryKey({ columns: [t.orderId, t.position] }), index("order_lines_seller_idx").on(t.sellerId), check("order_lines_qty", sql`${t.qty} >= 1`)],
);

export const shipmentStatus = orderingSchema.enum("shipment_status", SHIPMENT_STATUSES);
export const disputeReason = orderingSchema.enum("dispute_reason", DISPUTE_REASONS);

/** One parcel per shop per paid order: what it owes, where it is, and any dispute. */
export const shipments = orderingSchema.table(
  "shipments",
  {
    orderId: uuid()
      .notNull()
      .references(() => orders.id),
    sellerId: text().notNull(),
    status: shipmentStatus().notNull(),
    amountCents: integer().notNull(),
    carrier: text(),
    tracking: text(),
    shippedAt: timestamp({ withTimezone: true }),
    deliveredAt: timestamp({ withTimezone: true }),
    confirmedBy: text(),
    disputeReason: disputeReason(),
    disputeNote: text(),
    disputeOpenedAt: timestamp({ withTimezone: true }),
    resolution: text(),
    resolutionNote: text(),
    resolvedBy: uuid(),
    resolvedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.orderId, t.sellerId] }),
    index("shipments_seller_idx").on(t.sellerId, t.status),
    index("shipments_autoconfirm_idx").on(t.shippedAt).where(sql`${t.status} = 'shipped'`),
    index("shipments_disputed_idx").on(t.disputeOpenedAt).where(sql`${t.status} = 'disputed'`),
    check("shipments_amount", sql`${t.amountCents} >= 0`),
  ],
);
