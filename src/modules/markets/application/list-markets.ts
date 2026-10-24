import { money } from "@/shared/kernel";
import type { Country, FxRates, Region } from "../domain/country";
import type { CountryRepository, FxRateRepository } from "../domain/repositories";

/**
 * A country as the UI needs it: plain, serializable, with money in dollars for display.
 * Never do money math on a view; use the domain's `landedCost` with cents instead.
 */
export type MarketView = {
  code: string;
  name: string;
  region: Region;
  city: string;
  timeZone: string;
  /** Display currency. Falls back to USD when no exchange rate is known. */
  currency: string;
  /** Units of `currency` per US dollar. */
  rate: number;
  /** VAT/GST fraction; 0 when unknown (see `taxKnown`). */
  vat: number;
  taxKnown: boolean;
  vatLabel: string;
  /** Standard shipping from China, in US dollars. */
  shipping: number;
  freeShippingOver: number;
  extraDays: number;
};

export function toMarketView(country: Country, fx: FxRates): MarketView {
  const rate = fx.unitsPerUsd[country.currency];
  return {
    code: country.code,
    name: country.name,
    region: country.region,
    city: country.city,
    timeZone: country.timeZone,
    currency: rate ? country.currency : "USD",
    rate: rate ?? 1,
    vat: country.vatRate ?? 0,
    taxKnown: country.vatRate !== null,
    vatLabel: country.vatLabel,
    shipping: money.toDollars(country.shipping),
    freeShippingOver: money.toDollars(country.freeShippingOver),
    extraDays: country.extraDays,
  };
}

/** Every country we deliver to, priced for display. */
export function makeListMarkets(deps: { countries: CountryRepository; fx: FxRateRepository }) {
  return async function listMarkets(): Promise<MarketView[]> {
    const [countries, fx] = await Promise.all([deps.countries.list(), deps.fx.latest()]);
    return countries.map((c) => toMarketView(c, fx));
  };
}
