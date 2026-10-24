import { describe, expect, it } from "vitest";
import { fixedClock } from "@/shared/kernel";
import type { FxRates } from "../domain/country";
import type { FxRateRepository } from "../domain/repositories";
import { makeRefreshRates } from "./refresh-rates";

const currencies = (n: number, base = 2) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`C${String.fromCharCode(65 + (i % 26))}${String.fromCharCode(65 + Math.floor(i / 26))}`, base]));

function setup(fresh: FxRates | null, current: Record<string, number> = { USD: 1, ...currencies(120) }) {
  const saved: FxRates[] = [];
  const fx: FxRateRepository = { latest: async () => ({ asOf: new Date(0), unitsPerUsd: current }), save: async (r) => void saved.push(r) };
  const refresh = makeRefreshRates({ source: { usdRates: async () => fresh }, fx, clock: fixedClock("2026-10-24T00:00:00Z") });
  return { refresh, saved };
}

describe("refreshing exchange rates", () => {
  it("saves a complete, sane set", async () => {
    const { refresh, saved } = setup({ asOf: new Date("2026-10-24"), unitsPerUsd: { USD: 1, NGN: 1530, ...currencies(120, 2.2) } });
    expect(await refresh()).toMatchObject({ updated: true });
    expect(saved[0].unitsPerUsd.NGN).toBe(1530);
  });

  it("keeps the old rates when the feed is down, partial, or not USD-based", async () => {
    expect(await setup(null).refresh()).toMatchObject({ updated: false, reason: "source unavailable" });
    expect(await setup({ asOf: new Date(), unitsPerUsd: { USD: 1, EUR: 0.9 } }).refresh()).toMatchObject({ updated: false, reason: "too few currencies" });
    expect(await setup({ asOf: new Date(), unitsPerUsd: { USD: 1.1, ...currencies(120) } }).refresh()).toMatchObject({ updated: false, reason: "USD is not 1" });
  });

  it("refuses a feed where many currencies jump at once", async () => {
    const { refresh, saved } = setup({ asOf: new Date(), unitsPerUsd: { USD: 1, ...currencies(120, 20) } });
    expect(await refresh()).toMatchObject({ updated: false });
    expect(saved).toHaveLength(0);
  });
});
