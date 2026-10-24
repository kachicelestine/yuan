import { describe, expect, it } from "vitest";
import { cents } from "@/shared/kernel/money";
import type { CategoryId } from "./category";
import { createProduct, unitPrice, type Product } from "./product";
import type { SellerId } from "./seller";

const base: Omit<Product, "status"> = {
  id: "01890000-0000-7000-8000-000000000000",
  slug: "solar-panel-450w",
  title: "450 W bifacial solar panel",
  categoryId: "energy" as CategoryId,
  sellerId: "sunvolt" as SellerId,
  images: ["photo-1"],
  price: cents(5800),
  was: cents(7400),
  tiers: [
    { minQty: 10, price: cents(5200) },
    { minQty: 50, price: cents(4700) },
  ],
  minOrder: 1,
  rating: 4.8,
  reviewCount: 120,
  soldCount: 900,
  options: [{ name: "Frame", defaultIndex: 0, values: [{ label: "Silver", sub: null, delta: cents(0), swatch: null }, { label: "All black", sub: null, delta: cents(300), swatch: null }] }],
  highlights: ["Bifacial"],
  specs: [["Power", "450 W"]],
  buyersSay: null,
  shipsFrom: "Changzhou",
  leadTime: { minDays: 12, maxDays: 17 },
  dutyRate: 0.05,
};

const errorOf = (patch: Partial<Product>) => {
  const r = createProduct({ ...base, ...patch });
  return r.ok ? null : r.error.message;
};

describe("createProduct", () => {
  it("accepts a valid listing and defaults it to active", () => {
    const r = createProduct(base);
    expect(r.ok && r.value.status).toBe("active");
  });

  it.each([
    [{ slug: "Solar Panel" }, /slug/],
    [{ title: "ab" }, /title/],
    [{ images: [] }, /image/],
    [{ price: cents(0) }, /price must be positive/],
    [{ was: cents(5800) }, /previous price/],
    [{ minOrder: 0 }, /minimum order/],
    [{ tiers: [{ minQty: 50, price: cents(4700) }, { minQty: 10, price: cents(5200) }] }, /tiers must go up/],
    [{ price: null, was: null }, /quote-only/],
    [{ dutyRate: 1.5 }, /duty rate/],
    [{ leadTime: { minDays: 9, maxDays: 3 } }, /lead time/],
    [{ options: [{ name: "Size", defaultIndex: 2, values: [{ label: "S", sub: null, delta: cents(0), swatch: null }] }] }, /default is out of range/],
  ])("rejects %o", (patch, message) => {
    expect(errorOf(patch as Partial<Product>)).toMatch(message);
  });

  it("allows quote-only items without tiers", () => {
    expect(errorOf({ price: null, was: null, tiers: [] })).toBeNull();
  });
});

describe("unitPrice", () => {
  it("applies the highest tier the quantity reaches, plus the option surcharge", () => {
    expect(unitPrice(base, 1)).toBe(5800);
    expect(unitPrice(base, 10)).toBe(5200);
    expect(unitPrice(base, 49)).toBe(5200);
    expect(unitPrice(base, 50, cents(300))).toBe(5000);
  });
});
