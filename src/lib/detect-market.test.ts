import { describe, expect, it } from "vitest";
import { guessMarket } from "./detect-market";

const markets = [
  { code: "US", timeZone: "America/Los_Angeles" },
  { code: "NG", timeZone: "Africa/Lagos" },
  { code: "BR", timeZone: "America/Sao_Paulo" },
  { code: "DE", timeZone: "Europe/Berlin" },
];

describe("guessMarket", () => {
  it("trusts the clock over a phone set to US English", () => {
    expect(guessMarket(markets, "Africa/Lagos", ["en-US"])).toBe("NG");
  });

  it("falls back to the language's region", () => {
    expect(guessMarket(markets, "Europe/Vienna", ["pt-BR", "en"])).toBe("BR");
  });

  it("reads the region past a script subtag", () => {
    expect(guessMarket([...markets, { code: "TW", timeZone: "Asia/Taipei" }], undefined, ["zh-Hant-TW"])).toBe("TW");
  });

  it("gives up rather than guess a country it doesn't deliver to", () => {
    expect(guessMarket(markets, "Asia/Pyongyang", ["ko-KP", "en"])).toBeNull();
  });
});
