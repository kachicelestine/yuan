// Builds the markets seed (every ISO country) from open datasets:
//   countries and currencies: annexare/Countries (MIT)
//   VAT/GST rates:            valeriansaliou/node-sales-tax (MIT)
//   time zones:               IANA tz database zone.tab (public domain)
//   exchange rates:           open.er-api.com (free tier, attribution requested)
// Run: pnpm data:countries   (writes src/modules/markets/infrastructure/seed/*.json)
import { mkdir, writeFile } from "node:fs/promises";
import { markets as curated } from "@/fixtures/markets";

const SOURCES = {
  countries: "https://raw.githubusercontent.com/annexare/Countries/main/dist/countries.min.json",
  taxes: "https://raw.githubusercontent.com/valeriansaliou/node-sales-tax/master/res/sales_tax_rates.json",
  zones: "https://raw.githubusercontent.com/eggert/tz/main/zone.tab",
  fx: "https://open.er-api.com/v6/latest/USD",
};

type RawCountry = { name: string; native: string; phone: number[]; continent: string; capital: string; currency: string[] };
type RawTax = { type: "vat" | "gst" | "pst" | "hst" | "none"; rate: number };

/** Places nobody lives or ships to. */
const SKIP = new Set(["AQ", "BV", "HM"]);
/** Territories missing from zone.tab, mapped to the zone they use. */
const ZONE_FALLBACK: Record<string, string> = { AC: "Atlantic/St_Helena", TA: "Atlantic/St_Helena", XK: "Europe/Belgrade" };
/** Countries whose dataset continent doesn't match where their main city ships from. */
const REGION_OVERRIDE: Record<string, Region> = { RU: "Europe" };
const MIDDLE_EAST = new Set(["AE", "BH", "CY", "IL", "IQ", "IR", "JO", "KW", "LB", "OM", "PS", "QA", "SA", "SY", "TR", "YE"]);

/** Shipping and transit defaults by region, in US cents and days. */
const REGION_DEFAULTS = {
  Africa: { shippingCents: 700, freeShippingOverCents: 6000, extraDays: 3 },
  Europe: { shippingCents: 500, freeShippingOverCents: 4500, extraDays: 0 },
  Americas: { shippingCents: 600, freeShippingOverCents: 4900, extraDays: 1 },
  "Asia-Pacific": { shippingCents: 500, freeShippingOverCents: 4000, extraDays: 1 },
  "Middle East": { shippingCents: 500, freeShippingOverCents: 4500, extraDays: 0 },
} as const;

type Region = keyof typeof REGION_DEFAULTS;

function regionOf(code: string, continent: string): Region {
  if (REGION_OVERRIDE[code]) return REGION_OVERRIDE[code];
  if (MIDDLE_EAST.has(code)) return "Middle East";
  if (continent === "AF") return "Africa";
  if (continent === "EU") return "Europe";
  if (continent === "NA" || continent === "SA") return "Americas";
  return "Asia-Pacific";
}

/** Prefers the zone named after the capital, else the first zone listed for the country. */
function zoneOf(code: string, capital: string, zones: Record<string, string[]>) {
  const list = zones[code];
  if (!list?.length) return ZONE_FALLBACK[code] ?? "UTC";
  const city = capital.replace(/\s+/g, "_").toLowerCase();
  return list.find((z) => z.toLowerCase().endsWith(`/${city}`)) ?? list[0];
}

const taxLabel: Record<RawTax["type"], string> = { vat: "VAT", gst: "GST", pst: "Sales tax", hst: "HST", none: "Sales tax" };

async function get(url: string) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res;
}

async function main() {
  const [countries, taxes, zoneTab, fx] = await Promise.all([
    get(SOURCES.countries).then((r) => r.json() as Promise<Record<string, RawCountry>>),
    get(SOURCES.taxes).then((r) => r.json() as Promise<Record<string, RawTax>>),
    get(SOURCES.zones).then((r) => r.text()),
    get(SOURCES.fx).then((r) => r.json() as Promise<{ rates: Record<string, number>; time_last_update_utc: string }>),
  ]);

  const zones: Record<string, string[]> = {};
  for (const line of zoneTab.split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const [code, , zone] = line.split("\t");
    (zones[code] ??= []).push(zone);
  }

  const overrides = new Map(curated.map((m) => [m.code, m]));
  const names = new Intl.DisplayNames(["en"], { type: "region" });

  const rows = Object.entries(countries)
    .filter(([code]) => !SKIP.has(code))
    .map(([code, c]) => {
      const region = regionOf(code, c.continent);
      const tax = taxes[code];
      const own = overrides.get(code);
      const currency = c.currency.find((cur) => fx.rates[cur]) ?? "USD";
      let name = c.name;
      try {
        name = names.of(code) ?? c.name;
      } catch {
        // Codes ICU doesn't know (AC, TA, XK) keep the dataset's English name.
      }
      return {
        code,
        name: own?.name ?? name,
        region: own?.region ?? region,
        city: own?.city ?? (c.capital || name),
        timeZone: own?.timeZone ?? zoneOf(code, c.capital, zones),
        currency: own?.currency ?? currency,
        callingCode: c.phone[0] ? `+${c.phone[0]}` : null,
        // null = we don't know the rate yet; the UI says taxes are estimated.
        vatRate: own ? own.vat : tax ? tax.rate : null,
        vatLabel: own?.vatLabel ?? (tax ? taxLabel[tax.type] : "Import tax"),
        shippingCents: own ? Math.round(own.shipping * 100) : REGION_DEFAULTS[region].shippingCents,
        freeShippingOverCents: own ? Math.round(own.freeShippingOver * 100) : REGION_DEFAULTS[region].freeShippingOverCents,
        extraDays: own?.extraDays ?? REGION_DEFAULTS[region].extraDays,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "en"));

  const rates = Object.fromEntries(
    [...new Set(rows.map((r) => r.currency))].sort().map((cur) => [cur, fx.rates[cur]]),
  );

  const out = "src/modules/markets/infrastructure/seed";
  await mkdir(out, { recursive: true });
  await writeFile(`${out}/countries.json`, JSON.stringify(rows, null, 1) + "\n");
  await writeFile(`${out}/fx-rates.json`, JSON.stringify({ asOf: fx.time_last_update_utc, unitsPerUsd: rates }, null, 1) + "\n");
  console.log(`${rows.length} countries, ${Object.keys(rates).length} currencies, ${rows.filter((r) => r.vatRate === null).length} with unknown tax`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
