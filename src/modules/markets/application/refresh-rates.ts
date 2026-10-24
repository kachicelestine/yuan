import type { Clock } from "@/shared/kernel";
import type { FxRates } from "../domain/country";
import type { FxRateRepository } from "../domain/repositories";

/** Where fresh exchange rates come from (an HTTP API in production). */
export interface RateSource {
  /** Units of each currency per US dollar, or null when the source is unavailable. */
  usdRates(): Promise<FxRates | null>;
}

/** Fewer currencies than this means the source returned something partial; keep the old rates. */
const MIN_CURRENCIES = 100;

/**
 * Replaces the stored rates with fresh ones, but only if they look sane: USD must be 1,
 * enough currencies must be present, and no rate may move more than 50% from the last
 * one (a bad feed shouldn't reprice every country by 10x).
 */
export function makeRefreshRates(deps: { source: RateSource; fx: FxRateRepository; clock: Clock }) {
  return async (): Promise<{ updated: boolean; currencies: number; reason?: string }> => {
    const fresh = await deps.source.usdRates();
    if (!fresh) return { updated: false, currencies: 0, reason: "source unavailable" };
    const entries = Object.entries(fresh.unitsPerUsd).filter(([code, rate]) => /^[A-Z]{3}$/.test(code) && Number.isFinite(rate) && rate > 0);
    if (fresh.unitsPerUsd.USD !== 1) return { updated: false, currencies: entries.length, reason: "USD is not 1" };
    if (entries.length < MIN_CURRENCIES) return { updated: false, currencies: entries.length, reason: "too few currencies" };

    const current = await deps.fx.latest();
    const jumped = entries.filter(([code, rate]) => {
      const before = current.unitsPerUsd[code];
      return before !== undefined && (rate > before * 1.5 || rate < before / 1.5);
    });
    // A currency can genuinely collapse; a handful moving together is a broken feed.
    if (jumped.length > 5) return { updated: false, currencies: entries.length, reason: `${jumped.length} rates moved over 50%` };

    await deps.fx.save({ asOf: fresh.asOf ?? deps.clock.now(), unitsPerUsd: Object.fromEntries(entries) });
    return { updated: true, currencies: entries.length };
  };
}
