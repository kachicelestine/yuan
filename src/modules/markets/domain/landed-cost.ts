import { money, type Cents } from "@/shared/kernel";
import type { Country } from "./country";

export type LandedCost = Readonly<{
  item: Cents;
  shipping: Cents;
  duty: Cents;
  vat: Cents;
  total: Cents;
  /** False when the country's VAT rate is unknown, so the total excludes it. */
  taxKnown: boolean;
}>;

/**
 * What an order costs at the buyer's door: item, shipping (free above the country's
 * threshold), import duty on the item, then VAT on item + shipping + duty.
 */
export function landedCost(item: Cents, dutyRate: number, country: Country, shippingOverride?: Cents): LandedCost {
  const shipping = shippingOverride ?? (item === 0 || item >= country.freeShippingOver ? money.ZERO : country.shipping);
  const duty = money.percentOf(item, dutyRate);
  const vat = country.vatRate === null ? money.ZERO : money.percentOf(money.add(item, shipping, duty), country.vatRate);
  return { item, shipping, duty, vat, total: money.add(item, shipping, duty, vat), taxKnown: country.vatRate !== null };
}
