// Fixture data for the design phase. Peak sun hours are typical yearly averages for each
// country's main city; tariffs are illustrative household rates in USD per kWh.

export const solarProfiles: Record<string, { sunHours: number; tariff: number }> = {
  NG: { sunHours: 5.4, tariff: 0.16 },
  GH: { sunHours: 5.2, tariff: 0.14 },
  KE: { sunHours: 5.8, tariff: 0.21 },
  ZA: { sunHours: 5.9, tariff: 0.17 },
  EG: { sunHours: 6.3, tariff: 0.04 },
  CI: { sunHours: 5.0, tariff: 0.15 },
  GB: { sunHours: 2.8, tariff: 0.33 },
  DE: { sunHours: 3.0, tariff: 0.4 },
  FR: { sunHours: 3.4, tariff: 0.27 },
  US: { sunHours: 5.6, tariff: 0.17 },
  CA: { sunHours: 3.7, tariff: 0.12 },
  BR: { sunHours: 4.9, tariff: 0.16 },
  MX: { sunHours: 5.7, tariff: 0.11 },
  IN: { sunHours: 5.3, tariff: 0.09 },
  PH: { sunHours: 4.8, tariff: 0.2 },
  ID: { sunHours: 4.6, tariff: 0.1 },
  AU: { sunHours: 5.1, tariff: 0.24 },
  AE: { sunHours: 6.4, tariff: 0.08 },
};

/** Grid electricity's typical carbon intensity, kg CO₂ per kWh. */
export const gridCarbon = 0.45;

/** What one of each kit part contributes. */
export const kitParts = {
  panel: { slug: "solar-panel-450w-bifacial", kw: 0.45 },
  inverter: { slug: "hybrid-inverter-6kw", kw: 6 },
  battery: { slug: "wall-battery-5kwh", kwh: 5.12 },
  turbine: { slug: "wind-turbine-600w", kwhPerDay: 1.8 },
};
