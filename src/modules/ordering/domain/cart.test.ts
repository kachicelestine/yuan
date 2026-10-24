import { describe, expect, it } from "vitest";
import { MAX_CART_LINES, mergeCarts, normalizeCart, type CartItem } from "./cart";
import { MAX_QTY } from "./order";

const item = (slug: string, qty = 1, option: string | null = null, note: string | null = null): CartItem => ({ slug, option, qty, note });

describe("normalizeCart", () => {
  it("folds the same product and option into one line, adding quantities", () => {
    expect(normalizeCart([item("lamp", 1), item("lamp", 2), item("lamp", 1, "Brass")])).toEqual([item("lamp", 3), item("lamp", 1, "Brass")]);
  });

  it("drops malformed lines and clamps quantities", () => {
    const cart = normalizeCart([item("Not A Slug"), item("lamp", 0), item("lamp", Number.NaN), item("fan", 2.7), item("tea", 10_000)]);
    expect(cart).toEqual([item("fan", 2), item("tea", MAX_QTY)]);
  });

  it("treats a blank option as the defaults and caps the number of lines", () => {
    expect(normalizeCart([item("lamp", 1, "  ")])).toEqual([item("lamp")]);
    expect(normalizeCart(Array.from({ length: 80 }, (_, i) => item(`p${i}`)))).toHaveLength(MAX_CART_LINES);
  });
});

describe("mergeCarts", () => {
  it("keeps the larger quantity for items in both, so signing in twice never doubles them", () => {
    const account = [item("lamp", 2), item("fan", 1)];
    const device = [item("lamp", 1), item("tea", 3)];
    const once = mergeCarts(account, device);
    expect(once).toEqual([item("lamp", 2), item("fan", 1), item("tea", 3)]);
    expect(mergeCarts(once, device)).toEqual(once);
  });

  it("keeps a note from either side", () => {
    expect(mergeCarts([item("lamp", 1)], [item("lamp", 1, null, "LIVE PRICE HELD")])).toEqual([item("lamp", 1, null, "LIVE PRICE HELD")]);
  });
});
