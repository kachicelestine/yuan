import { parseCountryCode, type CountryRepository } from "@/modules/markets";
import type { Destinations } from "@/modules/ordering";

/** Lets checkout read a country's import rules from the markets module. */
export class MarketDestinations implements Destinations {
  constructor(
    private readonly countries: CountryRepository,
    private readonly restricted: ReadonlySet<string> = new Set(),
  ) {}

  async find(country: string) {
    const code = parseCountryCode(country);
    if (!code.ok || this.restricted.has(code.value)) return null;
    const c = await this.countries.findByCode(code.value);
    return c && { country: c.code, shipping: c.shipping, freeShippingOver: c.freeShippingOver, vatRate: c.vatRate };
  }
}
