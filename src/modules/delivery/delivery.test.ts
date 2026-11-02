import { describe, expect, it } from "vitest";
import { makeDelivery, type LiveRates } from "./application/delivery";
import { EasyshipRates } from "./infrastructure/easyship-rates";
import { CARRIERS, COUNTRIES, FREIGHT, SERVICES } from "./domain/catalogue";
import { cheapestDelivery, quoteDelivery, ratePrice } from "./domain/quote";
import { trackingLink } from "./domain/tracking";
import { parseWeight, shippingGrams } from "./domain/weight";
import { zoneOf } from "./domain/zones";

const nigeria = { country: "NG", region: "Africa" };
const uk = { country: "GB", region: "Europe" };

describe("zones", () => {
  it("bands countries the way carriers' rate charts do", () => {
    expect(zoneOf("NG", "Africa")).toBe("africa");
    expect(zoneOf("US", "Americas")).toBe("north-america");
    expect(zoneOf("BR", "Americas")).toBe("latin-america");
    expect(zoneOf("PH", "Asia-Pacific")).toBe("asia");
    expect(zoneOf("AU", "Asia-Pacific")).toBe("south-asia-oceania");
    expect(zoneOf("AE", "Middle East")).toBe("middle-east");
  });
});

describe("rate cards", () => {
  it("charges the first 500 g, then each further 500 g or part of it", () => {
    expect(ratePrice([1000, 300], 200)).toBe(1000);
    expect(ratePrice([1000, 300], 500)).toBe(1000);
    expect(ratePrice([1000, 300], 501)).toBe(1300);
    expect(ratePrice([1000, 300], 2000)).toBe(1900);
  });

  it("covers every country with at least the express carriers and the post", () => {
    for (const [country, region] of [["CD", "Africa"], ["IS", "Europe"], ["BO", "Americas"], ["FJ", "Asia-Pacific"], ["YE", "Middle East"]]) {
      const ids = quoteDelivery({ country, region, parcels: [800] }).map((o) => o.id);
      expect(ids).toEqual(expect.arrayContaining(["dhl-express-worldwide", "fedex-international-priority", "ups-worldwide-saver", "ems", "chinapost-small-packet"]));
    }
  });

  it("only offers a line where it delivers, and only parcels it can take", () => {
    const ng = quoteDelivery({ ...nigeria, parcels: [800] }).map((o) => o.id);
    expect(ng).toContain("speedaf-africa");
    expect(ng).not.toContain("yunexpress-direct");
    const gb = quoteDelivery({ ...uk, parcels: [800] }).map((o) => o.id);
    expect(gb).toEqual(expect.arrayContaining(["yunexpress-direct", "4px-global", "cainiao-standard"]));
    // A 3 kg box is too heavy for a small packet; 75 kg for any parcel carrier, so it goes as cargo.
    expect(quoteDelivery({ ...uk, parcels: [3000] }).map((o) => o.id)).not.toContain("chinapost-small-packet");
    expect(quoteDelivery({ ...uk, parcels: [75_000] }).map((o) => o.id)).toEqual(["air-freight"]);
    expect(quoteDelivery({ ...uk, parcels: [50_000_000] })).toEqual([]);
  });

  it("prices every parcel, cheapest first, and adds inland days", () => {
    const one = quoteDelivery({ ...uk, parcels: [800] });
    const two = quoteDelivery({ ...uk, parcels: [800, 800], extraDays: 2 });
    expect(one.map((o) => o.price)).toEqual([...one.map((o) => o.price)].sort((a, b) => a - b));
    const dhl = (list: typeof one) => list.find((o) => o.id === "dhl-express-worldwide")!;
    expect(dhl(two).price).toBe(dhl(one).price * 2);
    expect(dhl(two).days[1]).toBe(dhl(one).days[1] + 2);
    expect(cheapestDelivery({ ...uk, grams: 800 })?.id).toBe(one[0].id);
  });

  it("sends bulk as cargo: air from 21 kg, sea from 100 kg and far cheaper per kilo", () => {
    expect(quoteDelivery({ ...nigeria, parcels: [10_000] }).some((o) => o.kind === "freight")).toBe(false);
    const tonne = quoteDelivery({ ...nigeria, parcels: [1_000_000] });
    expect(tonne[0]).toMatchObject({ id: "sea-freight", company: "Sea freight", deliveredBy: "a local freight agent" });
    const air = tonne.find((o) => o.id === "air-freight")!;
    // The minimum charge covers the first 21 kg; then per 500 g.
    expect(quoteDelivery({ ...nigeria, parcels: [21_000] }).find((o) => o.id === "air-freight")?.price).toBe(FREIGHT[0].rates.africa![0]);
    expect(air.price).toBeGreaterThan(tonne[0].price * 3);
  });

  it("says who brings it to the door in the shopper's country", () => {
    const ng = quoteDelivery({ ...nigeria, parcels: [800] });
    expect(ng.find((o) => o.id === "ems")?.deliveredBy).toBe("NIPOST");
    expect(ng.find((o) => o.id === "fedex-international-priority")?.deliveredBy).toMatch(/Red Star Express/);
    expect(ng.find((o) => o.id === "dhl-express-worldwide")?.deliveredBy).toBe("DHL Express");
    const gb = quoteDelivery({ ...uk, parcels: [800] });
    expect(gb.find((o) => o.id === "yunexpress-direct")?.deliveredBy).toBe("Royal Mail, Evri, DPD or Yodel");
    expect(quoteDelivery({ country: "CD", region: "Africa", parcels: [800] }).find((o) => o.id === "ems")?.deliveredBy).toBe("the national post");
  });

  it("adds the country's own couriers when the platform has a hub there", () => {
    const withHub = quoteDelivery({ ...nigeria, parcels: [800, 400], hub: { country: "NG", city: "Lagos" } });
    const gig = withHub.find((o) => o.id === "hub:gig")!;
    const collect = withHub.find((o) => o.id === "hub:collect")!;
    expect(gig).toMatchObject({ company: "GIG Logistics", deliveredBy: "GIG Logistics", kind: "hub" });
    // The courier's fee is per parcel, on top of the air cargo to the hub.
    expect(gig.price - collect.price).toBe(COUNTRIES.NG.couriers!.find((c) => c.id === "gig")!.fee * 2);
    expect(withHub.map((o) => o.id)).toEqual(expect.arrayContaining(["hub:kwik", "hub:abc-cargo", "hub:nipost"]));
    // A hub elsewhere adds nothing here.
    expect(quoteDelivery({ ...uk, parcels: [800], hub: { country: "NG", city: "Lagos" } }).some((o) => o.kind === "hub")).toBe(false);
  });

  it("keeps the catalogue consistent", () => {
    const carriers = new Set(CARRIERS.map((c) => c.id));
    for (const s of [...SERVICES, ...FREIGHT]) {
      expect(carriers.has(s.carrier)).toBe(true);
      expect(Object.keys(s.days).sort()).toEqual(Object.keys(s.rates).sort());
    }
    expect(new Set([...SERVICES, ...FREIGHT].map((s) => s.id)).size).toBe(SERVICES.length + FREIGHT.length);
  });
});

describe("weights", () => {
  it("reads weights shops write, and ignores what isn't one", () => {
    expect(parseWeight("380 g")).toBe(380);
    expect(parseWeight("1,2 kg")).toBe(1200);
    expect(parseWeight("2 lb")).toBe(907);
    expect(parseWeight("19 momme")).toBeNull();
    expect(parseWeight("heavy")).toBeNull();
  });

  it("uses the listing's weight, else its category's, plus packaging", () => {
    expect(shippingGrams({ category: "fashion", specs: [["Weight", "1 kg"]] })).toBe(1150);
    expect(shippingGrams({ category: "jewelry", specs: [] })).toBe(160);
    expect(shippingGrams({ category: "nothing-like-it", specs: [["Colour", "Red"]] })).toBe(600);
  });
});

describe("tracking links", () => {
  it("goes to the carrier's own page when we know it, otherwise to a tracker that covers all", () => {
    expect(trackingLink("DHL", "1234567890")).toBe("https://www.dhl.com/global-en/home/tracking/tracking-express.html?submit=1&tracking-id=1234567890");
    expect(trackingLink("YunExpress", "YT2600000000000001")).toContain("yuntrack.com");
    expect(trackingLink("Royal Mail", "AB123456789GB")).toContain("royalmail.com");
    expect(trackingLink("Some Courier", "XY 1")).toBe("https://t.17track.net/en#nums=XY%201");
  });
});

describe("live rates", () => {
  const input = { ...uk, parcels: [800], valueCents: 4000 };

  it("replaces a carrier's estimate with its live price, and re-sorts", async () => {
    const live: LiveRates = { quote: async () => new Map([["dhl", { price: 100, days: [2, 3] as const }]]) };
    const [first] = await makeDelivery({ live, hubs: [] }).options(input);
    expect(first).toMatchObject({ id: "dhl-express-worldwide", price: 100, days: [2, 3], estimate: false });
  });

  it("falls back to the rate cards when the rates service fails", async () => {
    const live: LiveRates = { quote: () => Promise.reject(new Error("down")) };
    const options = await makeDelivery({ live, hubs: [] }).options(input);
    expect(options).toEqual(quoteDelivery(input));
  });

  it("asks Easyship in dollars and keeps each carrier's cheapest rate", async () => {
    const sent: RequestInit[] = [];
    const fake = (async (_url: string, init: RequestInit) => {
      sent.push(init);
      return Response.json({
        rates: [
          { courier_service: { umbrella_name: "DHL" }, total_charge: 31.5, currency: "USD", min_delivery_time: 2, max_delivery_time: 4 },
          { courier_service: { umbrella_name: "DHL" }, total_charge: 28.2, currency: "USD", min_delivery_time: 3, max_delivery_time: 5 },
          { courier_service: { umbrella_name: "Unknown Post" }, total_charge: 3, currency: "USD" },
          { courier_service: { umbrella_name: "FedEx" }, total_charge: 250, currency: "HKD" },
        ],
      });
    }) as unknown as typeof fetch;
    const rates = await new EasyshipRates({ token: "t".repeat(24), fetch: fake }).quote({ country: "GB", parcels: [800], valueCents: 4000, category: "tea" });
    expect([...rates]).toEqual([["dhl", { price: 2820, days: [3, 5] }]]);
    const body = JSON.parse(String(sent[0].body));
    expect(body).toMatchObject({ origin_address: { country_alpha2: "HK" }, destination_address: { country_alpha2: "GB" }, shipping_settings: { output_currency: "USD" } });
    expect(body.parcels[0]).toMatchObject({ total_actual_weight: 0.8, items: [{ hs_code: "090210", declared_customs_value: 40 }] });
  });
});
