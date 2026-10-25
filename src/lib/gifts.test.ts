import { describe, expect, it } from "vitest";
import { choosable } from "./gifts";

describe("what a gift's recipient may choose", () => {
  it("allows options whose values all cost the same", () => {
    expect(choosable({ name: "Size", values: [{ label: "S" }, { label: "M" }] })).toBe(true);
    expect(choosable({ name: "Size", values: [{ label: "S", delta: 0 }, { label: "M" }] })).toBe(true);
    expect(choosable({ name: "Size", values: [{ label: "S", delta: 2 }, { label: "M", delta: 2 }] })).toBe(true);
  });

  it("refuses options that change the price, or offer no choice", () => {
    expect(choosable({ name: "Capacity", values: [{ label: "2 kWh" }, { label: "3 kWh", delta: 200 }] })).toBe(false);
    expect(choosable({ name: "Size", values: [{ label: "One size" }] })).toBe(false);
  });
});
