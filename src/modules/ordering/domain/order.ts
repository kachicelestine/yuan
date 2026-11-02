import { domainError, err, ok, type Cents, type DomainError, type Result } from "@/shared/kernel";
import type { ShippingAddress } from "./address";
import type { Pricing, ShippingMethod } from "./pricing";

/** completed: every parcel delivered or refunded, and Protect has closed. */
export const ORDER_STATUSES = ["awaiting_payment", "paid", "cancelled", "completed"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

/** goods ship; a deposit only holds money toward a later order (pre-orders and pre-sales). */
export const ORDER_KINDS = ["goods", "deposit"] as const;
export type OrderKind = (typeof ORDER_KINDS)[number];

/** A snapshot of what was bought, so later catalog edits never change a placed order. */
export type OrderLine = Readonly<{
  productId: string;
  slug: string;
  title: string;
  image: string;
  sellerId: string;
  option: string | null;
  unitPrice: Cents;
  qty: number;
}>;

export type Order = Readonly<{
  id: string;
  /** What the buyer sees and quotes to support, e.g. LY-7KD2Q9. */
  number: string;
  /** The account that placed it; only they can see or pay it. */
  buyerId: string;
  status: OrderStatus;
  kind: OrderKind;
  country: string;
  /** Where it's delivered, in `country`. */
  address: ShippingAddress | null;
  shippingMethod: ShippingMethod;
  /** Null on deposits, and on orders placed before shoppers picked a company. */
  delivery: OrderDelivery | null;
  lines: readonly OrderLine[];
  pricing: Pricing;
  placedAt: Date;
  paidAt: Date | null;
  /** The creator code the buyer arrived through, if any (affiliates decides what it earns). */
  referral: string | null;
}>;

/** The delivery company the shopper picked, as it was offered (the shop ships with it). */
export type OrderDelivery = Readonly<{
  /** The option's id: a service, or `hub:<courier>` for a local courier from a hub. */
  id: string;
  company: string;
  service: string;
  deliveredBy: string;
  days: readonly [number, number];
  price: Cents;
  /** Priced from published rates rather than a live quote. */
  estimate: boolean;
}>;

export type OrderPlaced = Readonly<{ type: "OrderPlaced"; orderId: string; total: Cents; at: Date }>;
export type OrderPaid = Readonly<{ type: "OrderPaid"; orderId: string; at: Date }>;
export type OrderCancelled = Readonly<{ type: "OrderCancelled"; orderId: string; reason: "payment_lapsed"; at: Date }>;

export type OrderError = DomainError<"empty_order" | "invalid_quantity" | "order_not_payable" | "order_not_cancellable">;

export const MAX_QTY = 10_000;

// Crockford base32 without I, L, O, U: no look-alikes when read out over the phone.
const ALPHABET = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** A short, unguessable order number. `random` returns values in [0, 1). */
export function orderNumber(prefix: string, random: () => number = Math.random) {
  let code = "";
  for (let i = 0; i < 6; i++) code += ALPHABET[Math.floor(random() * ALPHABET.length)];
  return `${prefix}-${code}`;
}

export function placeOrder(props: {
  id: string;
  number: string;
  buyerId: string;
  country: string;
  address: ShippingAddress | null;
  shippingMethod: ShippingMethod;
  delivery?: OrderDelivery | null;
  lines: readonly OrderLine[];
  pricing: Pricing;
  at: Date;
  referral?: string | null;
  kind?: OrderKind;
}): Result<{ order: Order; event: OrderPlaced }, OrderError> {
  if (props.lines.length === 0) return err(domainError("empty_order", "An order needs at least one item."));
  if (props.lines.some((l) => !Number.isInteger(l.qty) || l.qty < 1 || l.qty > MAX_QTY)) {
    return err(domainError("invalid_quantity", `Quantities must be whole numbers from 1 to ${MAX_QTY}.`));
  }
  const { referral = null, kind = "goods", delivery = null, at, ...rest } = props;
  const order: Order = { ...rest, referral, kind, delivery, status: "awaiting_payment", placedAt: at, paidAt: null };
  return ok({ order, event: { type: "OrderPlaced", orderId: order.id, total: order.pricing.total, at: props.at } });
}

/**
 * Payment arrived. Paying twice is harmless: the second confirmation changes nothing.
 * An order cancelled because its payment window lapsed is reopened: the money arrived late,
 * but it arrived, and the buyer gets what they paid for.
 */
export function markPaid(order: Order, at: Date): Result<{ order: Order; event: OrderPaid | null }, OrderError> {
  if (order.status === "paid") return ok({ order, event: null });
  return ok({ order: { ...order, status: "paid", paidAt: at }, event: { type: "OrderPaid", orderId: order.id, at } });
}

/** The payment window closed with nothing paid. Cancelling twice changes nothing. */
export function cancelUnpaid(order: Order, at: Date): Result<{ order: Order; event: OrderCancelled | null }, OrderError> {
  if (order.status === "cancelled") return ok({ order, event: null });
  if (order.status !== "awaiting_payment") return err(domainError("order_not_cancellable", `Order ${order.number} is ${order.status}.`));
  return ok({ order: { ...order, status: "cancelled" }, event: { type: "OrderCancelled", orderId: order.id, reason: "payment_lapsed", at } });
}
