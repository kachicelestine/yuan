import type { MarketView, Region } from "@/modules/markets";

/**
 * Every page carries the full list of countries (the store needs it before the shopper
 * picks one). As objects that's ~75 KB of HTML, mostly the same 13 key names 249 times;
 * as positional tuples it's about a third of that.
 */
export type PackedMarket = [
  code: string,
  name: string,
  region: Region,
  city: string,
  timeZone: string,
  currency: string,
  rate: number,
  vat: number,
  taxKnown: 0 | 1,
  vatLabel: string,
  shipping: number,
  freeShippingOver: number,
  extraDays: number,
];

export const packMarkets = (markets: readonly MarketView[]): PackedMarket[] =>
  markets.map((m) => [m.code, m.name, m.region, m.city, m.timeZone, m.currency, m.rate, m.vat, m.taxKnown ? 1 : 0, m.vatLabel, m.shipping, m.freeShippingOver, m.extraDays]);

export const unpackMarkets = (packed: readonly PackedMarket[]): MarketView[] =>
  packed.map(([code, name, region, city, timeZone, currency, rate, vat, taxKnown, vatLabel, shipping, freeShippingOver, extraDays]) => ({
    code,
    name,
    region,
    city,
    timeZone,
    currency,
    rate,
    vat,
    taxKnown: taxKnown === 1,
    vatLabel,
    shipping,
    freeShippingOver,
    extraDays,
  }));
