import type { Country, CountryCode, FxRates } from "./country";

export interface CountryRepository {
  list(): Promise<Country[]>;
  findByCode(code: CountryCode): Promise<Country | null>;
}

export interface FxRateRepository {
  latest(): Promise<FxRates>;
  save(rates: FxRates): Promise<void>;
}
