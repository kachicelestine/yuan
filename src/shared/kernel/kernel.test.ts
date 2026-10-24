import { describe, expect, it } from "vitest";
import { err, expectOk, isId, money, newId, ok } from "./index";

describe("money", () => {
  it("rounds dollars to the nearest cent, half away from zero", () => {
    expect(money.fromDollars(12.345)).toBe(1235);
    expect(money.fromDollars(-12.345)).toBe(-1235);
    expect(money.fromDollars(0.1 + 0.2)).toBe(30);
  });

  it("refuses fractional cents", () => {
    expect(() => money.cents(10.5)).toThrow(RangeError);
  });

  it("adds, multiplies and takes percentages in whole cents", () => {
    const price = money.cents(1999);
    expect(money.add(price, price, money.cents(2))).toBe(4000);
    expect(money.times(price, 3)).toBe(5997);
    expect(money.percentOf(price, 0.075)).toBe(150);
    expect(money.toDollars(price)).toBe(19.99);
  });
});

describe("newId", () => {
  it("makes valid, unique UUIDv7s that sort by time", () => {
    const a = newId(1_700_000_000_000);
    const b = newId(1_700_000_000_001);
    expect(isId(a)).toBe(true);
    expect(a[14]).toBe("7");
    expect(a < b).toBe(true);
    expect(new Set(Array.from({ length: 1000 }, () => newId())).size).toBe(1000);
  });
});

describe("result", () => {
  it("unwraps success and throws with context on failure", () => {
    expect(expectOk(ok(5), "count")).toBe(5);
    expect(() => expectOk(err({ code: "not_found" }), "load product")).toThrow(/load product/);
  });
});
