import { count } from "drizzle-orm";
import type { Database } from "@/shared/infrastructure/database";
import countryRows from "./seed/countries.json";
import fx from "./seed/fx-rates.json";
import { countries, fxRates } from "./schema";
import type { Region } from "../domain/country";

/** Loads every country and the exchange-rate snapshot. Skips when countries already exist. */
export async function seedMarkets(db: Database) {
  const [{ value }] = await db.select({ value: count() }).from(countries);
  if (value > 0) return { skipped: true };

  const asOf = new Date(fx.asOf);
  await db.transaction(async (tx) => {
    await tx.insert(countries).values(countryRows.map((c) => ({ ...c, region: c.region as Region })));
    await tx.insert(fxRates).values(Object.entries(fx.unitsPerUsd as Record<string, number>).map(([currency, unitsPerUsd]) => ({ currency, unitsPerUsd, asOf })));
  });
  return { skipped: false, countries: countryRows.length };
}
