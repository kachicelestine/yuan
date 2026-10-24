import { beforeAll, describe, expect, it } from "vitest";
import { openDatabase, type Database } from "@/shared/infrastructure/database";
import { makeListMarkets } from "../application/list-markets";
import type { CountryCode } from "../domain/country";
import { DrizzleCountryRepository, DrizzleFxRateRepository } from "./drizzle-markets-repository";
import { seedMarkets } from "./seed";

describe("markets on Postgres", () => {
  let db: Database;

  beforeAll(async () => {
    db = await openDatabase({ kind: "memory" });
    await seedMarkets(db);
  });

  it("seeds every country once", async () => {
    const all = await new DrizzleCountryRepository(db).list();
    expect(all.length).toBeGreaterThan(240);
    expect(await seedMarkets(db)).toEqual({ skipped: true });
  });

  it("round-trips a country with money in cents", async () => {
    const ng = await new DrizzleCountryRepository(db).findByCode("NG" as CountryCode);
    expect(ng).toMatchObject({ name: "Nigeria", city: "Lagos", vatRate: 0.075, shipping: 700, timeZone: "Africa/Lagos" });
    expect(await new DrizzleCountryRepository(db).findByCode("ZZ" as CountryCode)).toBeNull();
  });

  it("lists markets with display currency and rate", async () => {
    const list = await makeListMarkets({ countries: new DrizzleCountryRepository(db), fx: new DrizzleFxRateRepository(db) })();
    const ng = list.find((m) => m.code === "NG")!;
    expect(ng.currency).toBe("NGN");
    expect(ng.rate).toBeGreaterThan(100);
    expect(ng.shipping).toBe(7);
    const unknownTax = list.find((m) => !m.taxKnown)!;
    expect(unknownTax.vat).toBe(0);
  });

  it("updates exchange rates in place", async () => {
    const fx = new DrizzleFxRateRepository(db);
    await fx.save({ asOf: new Date("2030-01-01T00:00:00Z"), unitsPerUsd: { NGN: 1500 } });
    const latest = await fx.latest();
    expect(latest.unitsPerUsd.NGN).toBe(1500);
    expect(latest.asOf.toISOString()).toBe("2030-01-01T00:00:00.000Z");
  });
});
