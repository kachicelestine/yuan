import { describe, expect, it } from "vitest";
import { MarketDestinations } from "./destinations";
import { makeListMarkets, parseRestricted, type Country, type CountryRepository, type FxRateRepository } from "@/modules/markets";

const country = (code: string) => ({ code, name: code, region: "Asia-Pacific", city: "", timeZone: "UTC", currency: "USD", vatRate: 0, vatLabel: "VAT", shipping: 500, freeShippingOver: 5000, extraDays: 0 }) as unknown as Country;
const countries = { list: async () => [country("KP"), country("NG")], findByCode: async (code: string) => country(code) } as unknown as CountryRepository;
const fx = { latest: async () => ({ unitsPerUsd: { USD: 1 } }) } as unknown as FxRateRepository;

describe("restricted destinations", () => {
  it("starts from the sanctions list", () => {
    expect([...parseRestricted(undefined)]).toEqual(expect.arrayContaining(["CU", "IR", "KP", "SY"]));
  });

  it("takes a list of its own, in any case, or none at all", () => {
    expect([...parseRestricted(" kp, ir ")]).toEqual(["KP", "IR"]);
    expect(parseRestricted("").size).toBe(0);
  });

  it("isn't offered as a market", async () => {
    const markets = await makeListMarkets({ countries, fx, restricted: new Set(["KP"]) })();
    expect(markets.map((m) => m.code)).toEqual(["NG"]);
  });

  it("is refused as a destination, whatever the browser sends", async () => {
    const destinations = new MarketDestinations(countries, new Set(["KP"]));
    expect(await destinations.find("KP")).toBeNull();
    expect(await destinations.find("NG")).not.toBeNull();
  });
});
