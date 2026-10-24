// Solar sizing for the kit builder. Rules of thumb an installer would use for a first quote.
import { gridCarbon, kitParts, solarProfiles } from "@/fixtures/energy";

export { kitParts };

export type KitInput = { monthlyBillUsd: number; market: string; backupHours: number; wind: boolean };
export type Kit = { panels: number; inverters: number; batteries: number; turbine: number };

export function profileFor(market: string) {
  return solarProfiles[market] ?? solarProfiles.US;
}

/** Sizes panels, inverters and batteries to cover a household's daily use. */
export function sizeKit({ monthlyBillUsd, market, backupHours, wind }: KitInput): Kit & { dailyUse: number } {
  const { sunHours, tariff } = profileFor(market);
  const dailyUse = monthlyBillUsd / 30 / tariff;
  // 80% system efficiency after heat, wiring and inverter losses.
  const panels = Math.max(2, Math.ceil(dailyUse / (kitParts.panel.kw * sunHours * 0.8)));
  const peakKw = panels * kitParts.panel.kw;
  const inverters = Math.max(1, Math.ceil(peakKw / kitParts.inverter.kw));
  // Night use: the share of the day the backup must cover.
  const batteries = backupHours === 0 ? 0 : Math.max(1, Math.ceil((dailyUse * (backupHours / 24)) / kitParts.battery.kwh));
  return { panels, inverters, batteries, turbine: wind ? 1 : 0, dailyUse };
}

/** What a kit produces and saves. */
export function kitOutcome(kit: Kit, market: string, dailyUse: number) {
  const { sunHours, tariff } = profileFor(market);
  const daily = kit.panels * kitParts.panel.kw * sunHours * 0.8 + kit.turbine * kitParts.turbine.kwhPerDay;
  const covered = Math.min(daily, dailyUse);
  return {
    dailyKwh: daily,
    coverage: dailyUse ? Math.min(1, daily / dailyUse) : 0,
    monthlySaving: covered * 30 * tariff,
    co2Tonnes: (covered * 365 * gridCarbon) / 1000,
  };
}
