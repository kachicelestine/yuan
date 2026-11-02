import { CARRIERS, COUNTRIES, FREIGHT, HUB_FREIGHT, POSTS, SERVICES, type CarrierKind, type Rate, type Service } from "./catalogue";
import { zoneOf, type Zone } from "./zones";

// What a shopper chooses between at checkout: every company that can carry this order's
// parcels from China to their country, priced for the parcels' weights, cheapest first.

/** A receiving point in the shopper's country, where local couriers take over. */
export type Hub = Readonly<{ country: string; city: string }>;

export type DeliveryOption = Readonly<{
  /** A service id; `hub:<courier>` for a local courier from the hub, `hub:collect` to collect there. */
  id: string;
  /** The company the shopper is choosing. */
  company: string;
  service: string;
  blurb: string;
  kind: CarrierKind | "hub";
  handover: "door" | "pickup";
  /** For all the order's parcels, in cents. */
  price: number;
  days: readonly [number, number];
  /** Who brings it to the door (or the counter) in the shopper's country. */
  deliveredBy: string;
  website: string;
  /** Priced from published rates, not a live quote from the carrier. */
  estimate: boolean;
}>;

export type QuoteInput = Readonly<{
  country: string;
  /** The country's region as the markets module names it. */
  region: string;
  /** Each parcel's packed weight in grams. */
  parcels: readonly number[];
  /** Extra days for deliveries beyond the main city. */
  extraDays?: number;
  /** The platform's receiving point in this country, if it has one. */
  hub?: Hub | null;
}>;

const STEP_GRAMS = 500;

/** One parcel's price on a rate card: the first 500 g (or a freight minimum), then each further 500 g or part. */
export const ratePrice = ([first, step]: Rate, grams: number, base = STEP_GRAMS) => first + Math.ceil(Math.max(0, grams - base) / STEP_GRAMS) * step;

export const postOf = (country: string) => POSTS[country] ?? "the national post";

const carrier = (id: string) => CARRIERS.find((c) => c.id === id)!;

/** Whether a service reaches a country (and has a price for its zone). */
export const serves = (s: Service, country: string, zone: Zone) => !!s.rates[zone] && (s.covers === "all" || s.covers.includes(country));

function deliveredBy(s: Service, country: string) {
  const local = COUNTRIES[country];
  if (s.delivers === "post") return postOf(country);
  if (s.delivers === "self") return local?.agents?.[s.carrier] ?? carrier(s.carrier).name;
  if (s.carrier === "air-freight" || s.carrier === "sea-freight") return "a local freight agent";
  const partners = local?.partners;
  return partners?.length ? (partners.length > 2 ? `${partners.slice(0, -1).join(", ")} or ${partners.at(-1)}` : partners.join(" or ")) : "a local courier";
}

const plus = (days: readonly [number, number], extra: number) => [days[0] + extra, days[1] + extra] as const;

/** Every way to get these parcels to the country, cheapest first. Empty when nothing can carry them. */
export function quoteDelivery(input: QuoteInput): DeliveryOption[] {
  const zone = zoneOf(input.country, input.region);
  const parcels = input.parcels.length ? input.parcels : [STEP_GRAMS];
  const extra = input.extraDays ?? 0;
  const options: DeliveryOption[] = [];

  for (const s of [...SERVICES, ...FREIGHT]) {
    if (!serves(s, input.country, zone) || parcels.some((g) => g > s.maxGrams || g < (s.minGrams ?? 0))) continue;
    const rate = s.rates[zone]!;
    const c = carrier(s.carrier);
    options.push({
      id: s.id,
      company: c.name,
      service: s.name,
      blurb: s.blurb,
      kind: c.kind,
      handover: s.handover,
      price: parcels.reduce((sum, g) => sum + ratePrice(rate, g, s.minGrams), 0),
      days: plus(s.days[zone]!, extra),
      deliveredBy: deliveredBy(s, input.country),
      website: c.website,
      estimate: true,
    });
  }

  const hub = input.hub?.country === input.country ? input.hub : null;
  if (hub) {
    const freight = HUB_FREIGHT[zone];
    const cargo = parcels.reduce((sum, g) => sum + ratePrice(freight.rate, g), 0);
    options.push({
      id: "hub:collect",
      company: `Our ${hub.city} hub`,
      service: "Collect from the hub",
      blurb: `Flown in with other orders; collect it at our ${hub.city} hub`,
      kind: "hub",
      handover: "pickup",
      price: cargo,
      days: freight.days,
      deliveredBy: `Our ${hub.city} hub`,
      website: "",
      estimate: true,
    });
    for (const courier of COUNTRIES[input.country]?.couriers ?? []) {
      options.push({
        id: `hub:${courier.id}`,
        company: courier.name,
        service: courier.handover === "pickup" ? "Collect near you" : "Delivery to your door",
        blurb: courier.note ?? `Flown in with other orders to ${hub.city}, then ${courier.name} takes it on`,
        kind: "hub",
        handover: courier.handover,
        price: cargo + courier.fee * parcels.length,
        days: [freight.days[0] + courier.days[0], freight.days[1] + courier.days[1]],
        deliveredBy: courier.name,
        website: courier.website,
        estimate: true,
      });
    }
  }

  return options.sort((a, b) => a.price - b.price || a.days[1] - b.days[1]);
}

/** The cheapest way to send one parcel of this weight there, or null when nothing can. */
export function cheapestDelivery(input: Omit<QuoteInput, "parcels"> & { grams: number }): DeliveryOption | null {
  return quoteDelivery({ ...input, parcels: [input.grams] })[0] ?? null;
}

/** The companies working inside a country, for showing what's available there. */
export function localCouriers(country: string) {
  return COUNTRIES[country]?.couriers ?? [];
}
