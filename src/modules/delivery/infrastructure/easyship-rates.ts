import type { LiveRates } from "../application/delivery";

// Live courier prices from Easyship's Rates API (POST /2024-09/rates). Easyship quotes from
// the origins it supports, so parcels are priced from Hong Kong, the usual gateway for
// shops in southern China. Prices come back in US dollars, duties left to the door (DDU).

const URL = "https://public-api.easyship.com/2024-09/rates";
const TIMEOUT_MS = 4_000;

/** Easyship names a courier by its umbrella brand; these are the ones our services use. */
const UMBRELLAS: Record<string, string> = { dhl: "dhl", fedex: "fedex", ups: "ups", aramex: "aramex", "sf express": "sf", sf: "sf" };

/** An HS code for each category, so customs-aware rates know roughly what's inside. */
const HS: Record<string, string> = {
  fashion: "610910", bags: "420222", jewelry: "711719", electronics: "854370", smarthome: "851762", energy: "850760",
  beauty: "330499", home: "392490", tea: "090210", toys: "950300", textiles: "630260", mobility: "871160",
};

type RatesResponse = { rates?: { courier_service?: { umbrella_name?: string }; total_charge?: number; currency?: string; min_delivery_time?: number; max_delivery_time?: number }[] };

export class EasyshipRates implements LiveRates {
  constructor(private readonly options: { token: string; origin?: string; fetch?: typeof fetch }) {}

  async quote(input: { country: string; parcels: readonly number[]; valueCents: number; category: string }) {
    const perParcel = input.valueCents / 100 / Math.max(1, input.parcels.length);
    const res = await (this.options.fetch ?? fetch)(URL, {
      method: "POST",
      headers: { authorization: `Bearer ${this.options.token}`, "content-type": "application/json" },
      body: JSON.stringify({
        origin_address: { country_alpha2: this.options.origin ?? "HK" },
        destination_address: { country_alpha2: input.country },
        incoterms: "DDU",
        shipping_settings: { output_currency: "USD", units: { weight: "kg", dimensions: "cm" } },
        parcels: input.parcels.map((grams) => ({
          total_actual_weight: grams / 1000,
          items: [{ description: "Merchandise", hs_code: HS[input.category] ?? "392690", quantity: 1, actual_weight: grams / 1000, declared_currency: "USD", declared_customs_value: Math.max(1, Math.round(perParcel)) }],
        })),
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) throw new Error(`Easyship rates: ${res.status}`);
    const body = (await res.json()) as RatesResponse;
    // The cheapest rate per carrier, in cents.
    const best = new Map<string, { price: number; days: readonly [number, number] }>();
    for (const r of body.rates ?? []) {
      const carrier = UMBRELLAS[(r.courier_service?.umbrella_name ?? "").toLowerCase()];
      if (!carrier || r.currency !== "USD" || typeof r.total_charge !== "number" || r.total_charge <= 0) continue;
      const price = Math.round(r.total_charge * 100);
      const days = [r.min_delivery_time ?? 2, r.max_delivery_time ?? r.min_delivery_time ?? 7] as const;
      if (!best.has(carrier) || best.get(carrier)!.price > price) best.set(carrier, { price, days });
    }
    return best;
  }
}
