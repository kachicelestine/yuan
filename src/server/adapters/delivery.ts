import type { Delivery } from "@/modules/delivery";
import type { DeliveryChoice, DeliveryQuotes, Destination } from "@/modules/ordering";
import { money, type Cents } from "@/shared/kernel";

/** Lets checkout ask the delivery module who can carry an order's parcels, and for how much. */
export class DeliveryOptions implements DeliveryQuotes {
  constructor(private readonly delivery: Delivery) {}

  async options(d: Destination, parcels: readonly number[], valueCents: Cents, category: string): Promise<DeliveryChoice[]> {
    const options = await this.delivery.options({ country: d.country, region: d.region, extraDays: d.extraDays, parcels, valueCents, category });
    return options.map((o) => ({ id: o.id, company: o.company, service: o.service, deliveredBy: o.deliveredBy, days: o.days, price: money.cents(o.price), estimate: o.estimate, kind: o.kind }));
  }
}
