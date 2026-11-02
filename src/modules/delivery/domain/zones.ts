// Shipping zones from China. Carriers price international parcels by how far they go, and
// these seven bands match how their published rate charts group the world.

export const ZONES = ["asia", "south-asia-oceania", "middle-east", "europe", "north-america", "latin-america", "africa"] as const;
export type Zone = (typeof ZONES)[number];

/** East and Southeast Asia: China's closest, cheapest lanes. */
const NEAR_ASIA = new Set(["JP", "KR", "KP", "MN", "TW", "HK", "MO", "SG", "MY", "TH", "VN", "PH", "ID", "KH", "LA", "MM", "BN", "TL"]);

/** The zone a country falls in, from its region (as the markets module names regions). */
export function zoneOf(country: string, region: string): Zone {
  if (region === "Africa") return "africa";
  if (region === "Europe") return "europe";
  if (region === "Middle East") return "middle-east";
  if (region === "Americas") return country === "US" || country === "CA" || country === "PR" || country === "BM" ? "north-america" : "latin-america";
  return NEAR_ASIA.has(country) ? "asia" : "south-asia-oceania";
}
