import { char, integer, numeric, pgSchema, text, timestamp } from "drizzle-orm/pg-core";
import { REGIONS } from "../domain/country";

export const marketsSchema = pgSchema("markets");

export const regionEnum = marketsSchema.enum("region", REGIONS);

export const countries = marketsSchema.table("countries", {
  code: char({ length: 2 }).primaryKey(),
  name: text().notNull(),
  region: regionEnum().notNull(),
  city: text().notNull(),
  timeZone: text().notNull(),
  currency: char({ length: 3 }).notNull(),
  callingCode: text(),
  vatRate: numeric({ precision: 6, scale: 4, mode: "number" }),
  vatLabel: text().notNull(),
  shippingCents: integer().notNull(),
  freeShippingOverCents: integer().notNull(),
  extraDays: integer().notNull().default(0),
});

export const fxRates = marketsSchema.table("fx_rates", {
  currency: char({ length: 3 }).primaryKey(),
  unitsPerUsd: numeric({ precision: 24, scale: 10, mode: "number" }).notNull(),
  asOf: timestamp({ withTimezone: true }).notNull(),
});
