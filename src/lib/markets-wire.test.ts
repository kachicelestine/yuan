import { describe, expect, it } from "vitest";
import type { MarketView } from "@/modules/markets";
import { packMarkets, unpackMarkets } from "./markets-wire";

const ghana: MarketView = {
  code: "GH",
  name: "Ghana",
  region: "Africa",
  city: "Accra",
  timeZone: "Africa/Accra",
  currency: "GHS",
  rate: 11.62,
  vat: 0.15,
  taxKnown: true,
  vatLabel: "VAT",
  shipping: 6,
  freeShippingOver: 49,
  extraDays: 3,
};

describe("markets on the wire", () => {
  it("round-trips every field", () => {
    const unknownTax = { ...ghana, code: "XK", taxKnown: false, vat: 0 };
    expect(unpackMarkets(packMarkets([ghana, unknownTax]))).toEqual([ghana, unknownTax]);
  });

  it("is much smaller than the objects", () => {
    const list = Array.from({ length: 249 }, () => ghana);
    expect(JSON.stringify(packMarkets(list)).length).toBeLessThan(JSON.stringify(list).length * 0.45);
  });
});
