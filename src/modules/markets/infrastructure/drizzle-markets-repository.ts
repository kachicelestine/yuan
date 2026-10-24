import { asc, eq } from "drizzle-orm";
import { cents } from "@/shared/kernel/money";
import type { Database } from "@/shared/infrastructure/database";
import type { Country, CountryCode, FxRates } from "../domain/country";
import type { CountryRepository, FxRateRepository } from "../domain/repositories";
import { countries, fxRates } from "./schema";

type CountryRow = typeof countries.$inferSelect;

const toCountry = (row: CountryRow): Country => ({
  code: row.code as CountryCode,
  name: row.name,
  region: row.region,
  city: row.city,
  timeZone: row.timeZone,
  currency: row.currency,
  callingCode: row.callingCode,
  vatRate: row.vatRate,
  vatLabel: row.vatLabel,
  shipping: cents(row.shippingCents),
  freeShippingOver: cents(row.freeShippingOverCents),
  extraDays: row.extraDays,
});

export class DrizzleCountryRepository implements CountryRepository {
  constructor(private readonly db: Database) {}

  async list() {
    const rows = await this.db.select().from(countries).orderBy(asc(countries.name));
    return rows.map(toCountry);
  }

  async findByCode(code: CountryCode) {
    const [row] = await this.db.select().from(countries).where(eq(countries.code, code)).limit(1);
    return row ? toCountry(row) : null;
  }
}

export class DrizzleFxRateRepository implements FxRateRepository {
  constructor(private readonly db: Database) {}

  async latest(): Promise<FxRates> {
    const rows = await this.db.select().from(fxRates);
    const asOf = rows.reduce((latest, r) => (r.asOf > latest ? r.asOf : latest), new Date(0));
    return { asOf, unitsPerUsd: Object.fromEntries(rows.map((r) => [r.currency, r.unitsPerUsd])) };
  }

  async save(rates: FxRates) {
    const rows = Object.entries(rates.unitsPerUsd).map(([currency, unitsPerUsd]) => ({ currency, unitsPerUsd, asOf: rates.asOf }));
    if (!rows.length) return;
    await this.db.transaction(async (tx) => {
      for (const row of rows) {
        await tx.insert(fxRates).values(row).onConflictDoUpdate({ target: fxRates.currency, set: { unitsPerUsd: row.unitsPerUsd, asOf: row.asOf } });
      }
    });
  }
}
