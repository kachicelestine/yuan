import { sql } from "drizzle-orm";
import { char, check, index, integer, pgSchema, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { ORDER_STATUSES } from "../domain/order";
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
