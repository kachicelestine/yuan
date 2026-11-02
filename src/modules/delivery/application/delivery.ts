import { SERVICES } from "../domain/catalogue";
import { quoteDelivery, type DeliveryOption, type Hub, type QuoteInput } from "../domain/quote";

/** Live prices from a rates service, per carrier (our carrier ids), in US cents. */
export interface LiveRates {
  quote(input: { country: string; parcels: readonly number[]; valueCents: number; category: string }): Promise<Map<string, { price: number; days: readonly [number, number] }>>;
}

export type DeliveryDeps = {
  /** When set, express carriers' prices come from it instead of the rate cards. */
  live: LiveRates | null;
  /** Countries where the platform receives consolidated cargo and local couriers take over. */
  hubs: readonly Hub[];
};

export type OptionsInput = Omit<QuoteInput, "hub"> & { valueCents: number; category?: string };

/** Delivery choices for an order: the researched rate cards, with live prices where a rates service gives them. */
export function makeDelivery({ live, hubs }: DeliveryDeps) {
  const carrierOf = new Map(SERVICES.map((s) => [s.id, s.carrier]));

  return {
    hubFor: (country: string) => hubs.find((h) => h.country === country) ?? null,

    async options(input: OptionsInput): Promise<DeliveryOption[]> {
      const hub = hubs.find((h) => h.country === input.country) ?? null;
      const estimated = quoteDelivery({ ...input, hub });
      if (!live || !estimated.length) return estimated;
      // A slow or failing rates service never blocks checkout: the rate cards stand in.
      const quotes = await live.quote({ country: input.country, parcels: input.parcels, valueCents: input.valueCents, category: input.category ?? "" }).catch(() => new Map<string, { price: number; days: readonly [number, number] }>());
      if (!quotes.size) return estimated;
      return estimated
        .map((o) => {
          const q = quotes.get(carrierOf.get(o.id) ?? "");
          return q ? { ...o, price: q.price, days: q.days, estimate: false } : o;
        })
        .sort((a, b) => a.price - b.price || a.days[1] - b.days[1]);
    },
  };
}

export type Delivery = ReturnType<typeof makeDelivery>;
