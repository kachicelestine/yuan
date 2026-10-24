import { describe, expect, it } from "vitest";
import { cents } from "@/shared/kernel/money";
import { parseCountryCode, type Country, type CountryCode } from "./country";
import { landedCost } from "./landed-cost";

const nigeria: Country = {
  code: "NG" as CountryCode,
  name: "Nigeria",
  region: "Africa",
  city: "Lagos",
  timeZone: "Africa/Lagos",
  currency: "NGN",
  callingCode: "+234",
  vatRate: 0.075,
  vatLabel: "VAT",
  shipping: cents(700),
  freeShippingOver: cents(6000),
  extraDays: 3,
};

describe("landedCost", () => {
  it("adds shipping below the free threshold, then duty, then VAT on the lot", () => {
    const l = landedCost(cents(5000), 0.1, nigeria);
    expect(l.shipping).toBe(700);
    expect(l.duty).toBe(500);
    expect(l.vat).toBe(465); // 7.5% of 5000 + 700 + 500
    expect(l.total).toBe(6665);
    expect(l.taxKnown).toBe(true);
  });

  it("ships free at or above the threshold", () => {
    expect(landedCost(cents(6000), 0, nigeria).shipping).toBe(0);
  });

  it("leaves VAT out, and says so, when the rate is unknown", () => {
    const l = landedCost(cents(5000), 0, { ...nigeria, vatRate: null });
    expect(l.vat).toBe(0);
    expect(l.taxKnown).toBe(false);
    expect(l.total).toBe(5700);
  });
});

describe("parseCountryCode", () => {
  it("normalises valid codes and rejects the rest", () => {
    expect(parseCountryCode(" ng ")).toEqual({ ok: true, value: "NG" });
    expect(parseCountryCode("NGA").ok).toBe(false);
  });
});
