import { domainError, err, ok, type Cents, type DomainError, type Result } from "@/shared/kernel";

export const REGIONS = ["Africa", "Europe", "Americas", "Asia-Pacific", "Middle East"] as const;
export type Region = (typeof REGIONS)[number];

/** ISO 3166-1 alpha-2, upper case. */
export type CountryCode = string & { readonly __brand: "CountryCode" };

export function parseCountryCode(value: string): Result<CountryCode, DomainError<"invalid_input">> {
  const code = value.trim().toUpperCase();
  return /^[A-Z]{2}$/.test(code) ? ok(code as CountryCode) : err(domainError("invalid_input", `"${value}" is not a two-letter country code`));
}

/** A country we deliver to, with the defaults that price an order sent there. */
export type Country = Readonly<{
  code: CountryCode;
  name: string;
  region: Region;
  /** The main delivery city, used in copy such as "Delivered to Lagos". */
  city: string;
  /** IANA zone of that city, for showing drop and live times locally. */
  timeZone: string;
  /** ISO 4217 code of the local currency, for display only. */
  currency: string;
  callingCode: string | null;
  /** Import VAT/GST as a fraction (0.075 = 7.5%), charged on item + shipping + duty. Null when unknown. */
  vatRate: number | null;
  vatLabel: string;
  shipping: Cents;
  freeShippingOver: Cents;
  /** Transit days on top of a product's own lead time. */
  extraDays: number;
}>;

/** Units of each currency per US dollar, as of a moment. */
export type FxRates = Readonly<{ asOf: Date; unitsPerUsd: Readonly<Record<string, number>> }>;
