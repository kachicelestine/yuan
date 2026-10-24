import type { FxRates } from "../domain/country";
import type { RateSource } from "../application/refresh-rates";

/**
 * Daily USD rates from open.er-api.com (free, no key; attribution requested, shown where
 * prices are converted). Any failure returns null so the stored rates stay in use.
 */
export class OpenErApiRateSource implements RateSource {
  constructor(
    private readonly url = "https://open.er-api.com/v6/latest/USD",
    private readonly fetcher: typeof fetch = fetch,
  ) {}

  async usdRates(): Promise<FxRates | null> {
    try {
      const res = await this.fetcher(this.url, { signal: AbortSignal.timeout(15_000) });
      if (!res.ok) return null;
      const body = (await res.json()) as { result?: string; time_last_update_unix?: number; rates?: Record<string, number> };
      if (body.result !== "success" || !body.rates) return null;
      return { asOf: new Date((body.time_last_update_unix ?? Date.now() / 1000) * 1000), unitsPerUsd: body.rates };
    } catch {
      return null;
    }
  }
}
