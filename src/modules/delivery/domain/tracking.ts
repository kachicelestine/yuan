import { CARRIERS, COUNTRIES } from "./catalogue";

// Where a shopper can follow a parcel: the carrier's own tracking page when we know its
// address, otherwise 17TRACK, which reads numbers from more than 3,000 carriers.

const UNIVERSAL = "https://t.17track.net/en#nums={n}";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9&]+/g, "");

const KNOWN = [
  ...CARRIERS.flatMap((c) => [c.name, ...(c.aliases ?? [])].map((name) => [norm(name), c.track] as const)),
  ...Object.values(COUNTRIES).flatMap((c) => (c.couriers ?? []).map((x) => [norm(x.name), x.track] as const)),
];

/** A link to follow this parcel, given the carrier's name as the shop entered it. */
export function trackingLink(carrierName: string, tracking: string) {
  const name = norm(carrierName);
  const template = KNOWN.find(([n, track]) => track && n === name)?.[1] ?? UNIVERSAL;
  return template.replace("{n}", encodeURIComponent(tracking.trim()));
}
