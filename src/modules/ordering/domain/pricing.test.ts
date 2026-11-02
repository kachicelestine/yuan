import { describe, expect, it } from "vitest";
import { cents } from "@/shared/kernel/money";
import { orderNumber, placeOrder, markPaid } from "./order";
import { parcelWeights, priceOrder, type PricingInput } from "./pricing";

const input = (patch: Partial<PricingInput> = {}): PricingInput => ({
  lines: [
    { unitPrice: cents(3400), qty: 2, dutyRate: 0.12, sellerId: "streetlab", shipsFrom: "Guangzhou", grams: 500 },
    { unitPrice: cents(1500), qty: 1, dutyRate: 0.04, sellerId: "pals", shipsFrom: "Dongguan", grams: 300 },
  ],
  destination: { country: "NG", region: "Africa", extraDays: 3, freeShippingOver: cents(6000), vatRate: 0.075 },
  delivery: { price: cents(900), cheapest: cents(900) },
  combineParcels: true,
  payDutiesNow: true,
  coupon: null,
  ...patch,
});

describe("priceOrder", () => {
  it("prices items, free shipping over the threshold, duty and VAT", () => {
    const p = priceOrder(input());
    expect(p.subtotal).toBe(8300);
    expect(p.shipping).toBe(0);
    expect(p.duty).toBe(816 + 60);
    expect(p.vat).toBe(688); // 7.5% of 8300 + 0 + 876 = 688.2
    expect(p.total).toBe(8300 + 876 + 688);
    expect(p.dueAtDoor).toBe(0);
  });

  it("charges the chosen company, and over the threshold only what it costs above the cheapest", () => {
    const small = { lines: [{ unitPrice: cents(1000), qty: 1, dutyRate: 0, sellerId: "a", shipsFrom: "X", grams: 400 }, { unitPrice: cents(1000), qty: 2, dutyRate: 0, sellerId: "b", shipsFrom: "Y", grams: 300 }] };
    const dhl = { price: cents(3200), cheapest: cents(1400) };
    expect(priceOrder(input({ ...small, combineParcels: false, delivery: dhl }))).toMatchObject({ shipping: 3200, parcels: 2 });
    // Big enough for free shipping: the cheapest company is free, DHL costs the difference.
    expect(priceOrder(input({ delivery: dhl })).shipping).toBe(1800);
    expect(priceOrder(input({ delivery: { price: cents(900), cheapest: cents(900) } })).shipping).toBe(0);
  });

  it("makes one parcel per origin unless combined, weighed for the carrier", () => {
    const lines = [
      { shipsFrom: "Guangzhou", grams: 500, qty: 2 },
      { shipsFrom: "Yiwu", grams: 300, qty: 1 },
      { shipsFrom: "Guangzhou", grams: 200, qty: 1 },
    ];
    expect(parcelWeights(lines, false)).toEqual([1200, 300]);
    expect(parcelWeights(lines, true)).toEqual([1500]);
    expect(parcelWeights([], true)).toEqual([]);
  });

  it("leaves duties for the door when asked, and doesn't collect unknown VAT", () => {
    const p = priceOrder(input({ payDutiesNow: false }));
    expect(p.total).toBe(8300);
    expect(p.dueAtDoor).toBe(876 + 688);
    expect(priceOrder(input({ destination: { country: "CD", region: "Africa", extraDays: 3, freeShippingOver: cents(6000), vatRate: null } })).vat).toBe(0);
  });

  it("applies coupons only when the qualifying spend is met", () => {
    const sellerCoupon = { id: "street8", kind: "percent" as const, value: 0.08, minSpend: cents(6000), sellerId: "streetlab" };
    expect(priceOrder(input({ coupon: sellerCoupon })).discount).toBe(544);
    expect(priceOrder(input({ coupon: { ...sellerCoupon, minSpend: cents(9000) } })).discount).toBe(0);
    const flat = priceOrder(input({ coupon: { id: "welcome5", kind: "amount", value: 500, minSpend: cents(5000), sellerId: null } }));
    expect(flat.discount).toBe(500);
    expect(flat.couponId).toBe("welcome5");
  });
});

describe("order", () => {
  const props = { id: "o1", number: "LY-ABC123", buyerId: "b1", country: "NG", address: null, shippingMethod: "standard" as const, pricing: priceOrder(input()), at: new Date("2026-10-24T00:00:00Z") };
  const line = { productId: "p", slug: "s", title: "t", image: "i", sellerId: "x", option: null, unitPrice: cents(100), qty: 1 };

  it("needs at least one line with a sane quantity", () => {
    expect(placeOrder({ ...props, lines: [] }).ok).toBe(false);
    expect(placeOrder({ ...props, lines: [{ ...line, qty: 0 }] }).ok).toBe(false);
  });

  it("can be paid once; paying again changes nothing", () => {
    const placed = placeOrder({ ...props, lines: [line] });
    if (!placed.ok) throw new Error("placed");
    const paid = markPaid(placed.value.order, new Date());
    expect(paid.ok && paid.value.order.status).toBe("paid");
    const again = paid.ok ? markPaid(paid.value.order, new Date()) : null;
    expect(again?.ok && again.value.event).toBeNull();
  });

  it("makes readable order numbers without look-alike letters", () => {
    expect(orderNumber("LY", () => 0)).toBe("LY-000000");
    expect(orderNumber("LY")).toMatch(/^LY-[0-9A-HJKMNP-TV-Z]{6}$/);
  });
});
