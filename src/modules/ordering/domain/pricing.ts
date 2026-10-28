import { money, type Cents } from "@/shared/kernel";

export const SHIPPING_METHODS = ["standard", "express"] as const;
export type ShippingMethod = (typeof SHIPPING_METHODS)[number];

/** Surcharge per parcel on top of the country's standard rate. */
export const SHIPPING_SURCHARGE: Record<ShippingMethod, Cents> = { standard: money.cents(0), express: money.cents(1800) };

/** The import rules of the country an order ships to. */
export type Destination = Readonly<{
  country: string;
  shipping: Cents;
  freeShippingOver: Cents;
  /** VAT/GST fraction, or null when unknown (then it isn't collected). */
  vatRate: number | null;
}>;

/** A line priced by the catalog: never a price sent by the browser. */
export type PricedLine = Readonly<{
  unitPrice: Cents;
  qty: number;
  dutyRate: number;
  sellerId: string;
  /** City the parcel leaves from; each origin is a parcel unless combined. */
  shipsFrom: string;
}>;

export type CouponRule = Readonly<{
  id: string;
  kind: "amount" | "percent" | "free_shipping";
  /** Cents for `amount`, a fraction for `percent`; ignored for free shipping. */
  value: number;
  minSpend: Cents;
  /** Only this seller's items count towards it, when set. */
  sellerId: string | null;
}>;

export type PricingInput = Readonly<{
  lines: readonly PricedLine[];
  destination: Destination;
  shippingMethod: ShippingMethod;
  /** Repack every origin's parcel into one box at the hub. */
  combineParcels: boolean;
  /** Collect duties and VAT now (true) or leave them for the courier at the door. */
  payDutiesNow: boolean;
  coupon: CouponRule | null;
}>;

export type Pricing = Readonly<{
  subtotal: Cents;
  discount: Cents;
  shipping: Cents;
  duty: Cents;
  vat: Cents;
  /** Duties and VAT the courier will collect, when the buyer chose to pay them at the door. */
  dueAtDoor: Cents;
  /** What the buyer pays now. */
  total: Cents;
  parcels: number;
  couponId: string | null;
  /** The shop that pays for the discount (its own voucher); null when the platform does. */
  fundedBy: string | null;
}>;

/** What a coupon takes off, or zero when the order doesn't qualify. */
export function couponDiscount(coupon: CouponRule, lines: readonly PricedLine[], shipping: Cents): Cents {
  const base = money.add(...lines.filter((l) => !coupon.sellerId || l.sellerId === coupon.sellerId).map((l) => money.times(l.unitPrice, l.qty)));
  if (base < coupon.minSpend) return money.ZERO;
  if (coupon.kind === "free_shipping") return shipping;
  if (coupon.kind === "percent") return money.percentOf(base, coupon.value);
  return money.cents(Math.min(coupon.value, base));
}

/**
 * Prices an order: items, shipping per parcel (free above the country's threshold),
 * the coupon, import duty on items, then VAT on items + shipping + duty.
 */
export function priceOrder(input: PricingInput): Pricing {
  const { lines, destination: d } = input;
  const subtotal = money.add(...lines.map((l) => money.times(l.unitPrice, l.qty)));
  const origins = new Set(lines.map((l) => l.shipsFrom)).size;
  const parcels = input.combineParcels ? 1 : Math.max(origins, 1);
  const base = subtotal >= d.freeShippingOver ? money.ZERO : d.shipping;
  const shipping = money.times(money.add(base, SHIPPING_SURCHARGE[input.shippingMethod]), parcels);
  const discount = input.coupon ? couponDiscount(input.coupon, lines, shipping) : money.ZERO;
  const duty = money.add(...lines.map((l) => money.percentOf(money.times(l.unitPrice, l.qty), l.dutyRate)));
  const vat = d.vatRate === null ? money.ZERO : money.percentOf(money.add(subtotal, shipping, duty), d.vatRate);
  const taxes = money.add(duty, vat);
  const total = money.max(money.ZERO, money.add(money.subtract(subtotal, discount), shipping, input.payDutiesNow ? taxes : money.ZERO));
  return {
    subtotal,
    discount,
    shipping,
    duty,
    vat,
    dueAtDoor: input.payDutiesNow ? money.ZERO : taxes,
    total,
    parcels,
    couponId: discount > 0 ? (input.coupon?.id ?? null) : null,
    fundedBy: discount > 0 ? (input.coupon?.sellerId ?? null) : null,
  };
}
