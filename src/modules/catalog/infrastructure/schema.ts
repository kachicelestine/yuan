import { sql, type SQL } from "drizzle-orm";
import { boolean, check, customType, date, index, integer, jsonb, numeric, pgSchema, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { SELLER_KINDS, type Storefront } from "../domain/seller";
import type { ProductOption } from "../domain/product";

export const catalogSchema = pgSchema("catalog");

const tsvector = customType<{ data: string }>({ dataType: () => "tsvector" });

export const sellerKind = catalogSchema.enum("seller_kind", SELLER_KINDS);
export const productStatus = catalogSchema.enum("product_status", ["draft", "active", "archived"]);

export const categories = catalogSchema.table("categories", {
  id: text().primaryKey(),
  label: text().notNull(),
  image: text().notNull(),
  hero: text().notNull(),
  blurb: text().notNull(),
  subcategories: text().array().notNull().default(sql`'{}'`),
  position: integer().notNull().default(0),
});

export const sellers = catalogSchema.table("sellers", {
  id: text().primaryKey(),
  name: text().notNull(),
  kind: sellerKind().notNull(),
  city: text().notNull(),
  avatar: text().notNull(),
  verified: boolean().notNull().default(false),
  audited: text(),
  yearsInBusiness: integer(),
  /** Storefront value object; one per seller, always read with it. */
  storefront: jsonb().$type<Storefront>(),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

/** Stored option shape: money as integer cents. */
export type StoredOption = Omit<ProductOption, "values"> & { values: { label: string; sub: string | null; deltaCents: number; swatch: string | null }[] };

export const products = catalogSchema.table(
  "products",
  {
    id: uuid().primaryKey(),
    slug: text().notNull().unique(),
    title: text().notNull(),
    categoryId: text()
      .notNull()
      .references(() => categories.id),
    sellerId: text()
      .notNull()
      .references(() => sellers.id),
    status: productStatus().notNull().default("active"),
    images: text().array().notNull(),
    priceCents: integer(),
    wasCents: integer(),
    tiers: jsonb().$type<{ minQty: number; priceCents: number }[]>().notNull().default([]),
    minOrder: integer().notNull().default(1),
    rating: numeric({ precision: 2, scale: 1, mode: "number" }).notNull().default(0),
    reviewCount: integer().notNull().default(0),
    soldCount: integer(),
    options: jsonb().$type<StoredOption[]>().notNull().default([]),
    highlights: text().array().notNull().default(sql`'{}'`),
    specs: jsonb().$type<[string, string][]>().notNull().default([]),
    buyersSay: text(),
    shipsFrom: text().notNull(),
    leadMinDays: integer().notNull(),
    leadMaxDays: integer().notNull(),
    dutyRate: numeric({ precision: 5, scale: 4, mode: "number" }).notNull(),
    /** Highlights, specs and options flattened for search; written by the repository. */
    keywords: text().notNull().default(""),
    search: tsvector().generatedAlwaysAs(
      (): SQL => sql`setweight(to_tsvector('english', ${products.title}), 'A') || setweight(to_tsvector('english', ${products.keywords}), 'B')`,
    ),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("products_category_idx").on(t.categoryId),
    index("products_seller_idx").on(t.sellerId),
    index("products_search_idx").using("gin", t.search),
    check("products_price_positive", sql`${t.priceCents} is null or ${t.priceCents} > 0`),
    check("products_min_order", sql`${t.minOrder} >= 1`),
    check("products_lead_time", sql`${t.leadMinDays} >= 1 and ${t.leadMaxDays} >= ${t.leadMinDays}`),
    check("products_duty_rate", sql`${t.dutyRate} between 0 and 1`),
  ],
);

/** Reviews already counted in a product's rating, so a redelivered event counts once. */
/** Each listing's price, once a day (the last one seen that day), for price history. */
export const pricePoints = catalogSchema.table(
  "price_points",
  {
    slug: text().notNull(),
    day: date({ mode: "string" }).notNull(),
    priceCents: integer().notNull(),
  },
  (t) => [primaryKey({ columns: [t.slug, t.day] })],
);

/** Orders already counted into products' sold counts (OrderPaid is delivered at least once). */
export const appliedSales = catalogSchema.table("applied_sales", {
  orderId: uuid().primaryKey(),
  appliedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});

export const appliedRatings = catalogSchema.table("applied_ratings", {
  reviewId: text().primaryKey(),
  appliedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
});
