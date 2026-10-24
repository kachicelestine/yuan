import { describe, expect, it } from "vitest";
import { cents } from "@/shared/kernel/money";
import { orderNumber, placeOrder, markPaid } from "./order";
import { priceOrder, type PricingInput } from "./pricing";

const input = (patch: Partial<PricingInput> = {}): PricingInput => ({
  lines: [
    { unitPrice: cents(3400), qty: 2, dutyRate: 0.12, sellerId: "streetlab", shipsFrom: "Guangzhou" },
    { unitPrice: cents(1500), qty: 1, dutyRate: 0.04, sellerId: "pals", shipsFrom: "Dongguan" },
  ],
  destination: { country: "NG", shipping: cents(700), freeShippingOver: cents(6000), vatRate: 0.075 },
  shippingMethod: "standard",
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

  it("charges each origin as a parcel unless combined, plus the express surcharge", () => {
    const small = { lines: [{ unitPrice: cents(1000), qty: 1, dutyRate: 0, sellerId: "a", shipsFrom: "X" }, { unitPrice: cents(1000), qty: 1, dutyRate: 0, sellerId: "b", shipsFrom: "Y" }] };
    expect(priceOrder(input({ ...small, combineParcels: false })).shipping).toBe(1400);
    expect(priceOrder(input({ ...small, combineParcels: true, shippingMethod: "express" })).shipping).toBe(700 + 1800);
  });

  it("leaves duties for the door when asked, and doesn't collect unknown VAT", () => {
    const p = priceOrder(input({ payDutiesNow: false }));
    expect(p.total).toBe(8300);
    expect(p.dueAtDoor).toBe(876 + 688);
    expect(priceOrder(input({ destination: { country: "CD", shipping: cents(700), freeShippingOver: cents(6000), vatRate: null } })).vat).toBe(0);
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
  const props = { id: "o1", number: "LY-ABC123", buyerId: "b1", country: "NG", shippingMethod: "standard" as const, pricing: priceOrder(input()), at: new Date("2026-10-24T00:00:00Z") };
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
