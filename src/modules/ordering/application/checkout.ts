import { domainError, err, ok, type Cents, type Clock, type DomainError, type Result } from "@/shared/kernel";
import { MAX_QTY, placeOrder, type OrderError, type OrderLine } from "../domain/order";
import { priceOrder, type PricedLine, type Pricing, type ShippingMethod } from "../domain/pricing";
import type { CouponCatalog } from "../domain/repositories";
import { holdCovers, type CatalogLineError, type CheckoutScope, type Destinations, type OrderCatalog, type PriceHolds, type UnitOfWork } from "./ports";

export type CheckoutRequest = Readonly<{
  /** The signed-in buyer, from the session (never from the request body). */
  buyerId: string;
  lines: readonly { slug: string; option: string | null; qty: number }[];
  country: string;
  shippingMethod: ShippingMethod;
  combineParcels: boolean;
  payDutiesNow: boolean;
  couponId: string | null;
  rail: string;
  /** Creator code from the buyer's last referral link, if any. */
  referral?: string | null;
}>;

export type CheckoutResult = Readonly<{ orderId: string; orderNumber: string; invoiceId: string; pricing: Pricing }>;

export type CheckoutError =
  | CatalogLineError
  | OrderError
  | DomainError<"too_many_lines" | "unknown_country" | "below_min_order" | "rail_unavailable" | "invalid_amount" | "coupon_unavailable">;

export const MAX_LINES = 50;

export type CheckoutDeps = {
  catalog: OrderCatalog;
  /** Live prices and auction wins this buyer holds; checkout honours them. */
  holds?: PriceHolds;
  destinations: Destinations;
  coupons: CouponCatalog;
  uow: UnitOfWork<CheckoutScope>;
  clock: Clock;
  newId: () => string;
  newOrderNumber: () => string;
};

/**
 * Turns a bag into an order awaiting payment. Every price comes from the catalog and
 * every rule from the destination country, never from the browser; the order and
 * its invoice are saved together or not at all.
 */
export function makeCheckout(deps: CheckoutDeps) {
  return async function checkout(req: CheckoutRequest): Promise<Result<CheckoutResult, CheckoutError>> {
    if (req.lines.length === 0) return err(domainError("empty_order", "Your bag is empty."));
    if (req.lines.length > MAX_LINES) return err(domainError("too_many_lines", `Split orders over ${MAX_LINES} lines.`));
    if (req.lines.some((l) => !Number.isInteger(l.qty) || l.qty < 1 || l.qty > MAX_QTY)) {
      return err(domainError("invalid_quantity", `Quantities must be whole numbers from 1 to ${MAX_QTY}.`));
    }

    const destination = await deps.destinations.find(req.country);
    if (!destination) return err(domainError("unknown_country", `We can't deliver to "${req.country}" yet.`));

    const priced: { line: OrderLine; pricing: PricedLine }[] = [];
    for (const l of req.lines) {
      const r = await deps.catalog.priceLine(l.slug, l.option, l.qty);
      if (!r.ok) return r;
      const c = r.value;
      // A held price (live, an auction win, an accepted quote) applies when it's lower, for
      // the quantities it covers; for a listing sold by quote it's the only price.
      const hold = deps.holds ? await deps.holds.best(req.buyerId, l.slug, l.qty) : null;
      const held = hold !== null && holdCovers(hold, l.qty) && (c.unitPrice === null || hold.price < c.unitPrice);
      if (!held && c.unitPrice === null) return err(domainError("quote_only", `${c.title} is sold by quote; request one from the shop.`));
      const unitPrice = held ? hold.price : c.unitPrice!;
      if (!held && l.qty < c.minOrder) return err(domainError("below_min_order", `${c.title} has a minimum order of ${c.minOrder}.`));
      priced.push({
        line: { productId: c.productId, slug: c.slug, title: c.title, image: c.image, sellerId: c.sellerId, option: l.option, unitPrice, qty: l.qty },
        pricing: { unitPrice, qty: l.qty, dutyRate: c.dutyRate, sellerId: c.sellerId, shipsFrom: c.shipsFrom },
      });
    }

    const coupon = req.couponId ? await deps.coupons.findUsable(req.buyerId, req.couponId) : null;
    // Say so instead of quietly charging more than the buyer was shown.
    if (req.couponId && !coupon) return err(domainError("coupon_unavailable", "That coupon isn't in your wallet any more. Your total has changed; take another look."));
    const pricing = priceOrder({
      lines: priced.map((p) => p.pricing),
      destination,
      shippingMethod: req.shippingMethod,
      combineParcels: req.combineParcels,
      payDutiesNow: req.payDutiesNow,
      coupon,
    });

    const placed = placeOrder({
      id: deps.newId(),
      number: deps.newOrderNumber(),
      buyerId: req.buyerId,
      country: destination.country,
      shippingMethod: req.shippingMethod,
      lines: priced.map((p) => p.line),
      pricing,
      at: deps.clock.now(),
      referral: req.referral ?? null,
    });
    if (!placed.ok) return placed;
    const { order, event } = placed.value;

    return deps.uow.run(async ({ orders, payments, coupons, events }) => {
      await orders.save(order);
      await events.record(order.id, event);
      // Re-checked inside the transaction: another checkout may have used it a moment ago.
      if (pricing.couponId && !(await coupons.reserve(req.buyerId, pricing.couponId, order.id))) {
        throw new CheckoutAbort(domainError("coupon_unavailable", "That coupon was just used on another order. Your total has changed; try again."));
      }
      const payment = await payments.request({ orderId: order.id, amount: pricing.total, rail: req.rail });
      // Throwing rolls the order back with the transaction; the error is re-shaped below.
      if (!payment.ok) throw new CheckoutAbort(payment.error);
      return ok({ orderId: order.id, orderNumber: order.number, invoiceId: payment.value.invoiceId, pricing });
    }).catch((e: unknown) => {
      if (e instanceof CheckoutAbort) return err(e.error);
      throw e;
    });
  };
}

class CheckoutAbort extends Error {
  constructor(readonly error: DomainError<"rail_unavailable" | "invalid_amount" | "coupon_unavailable">) {
    super(error.message);
  }
}

/** Totals in dollars for display. */
export const pricingInDollars = (p: Pricing) => {
  const d = (c: Cents) => c / 100;
  return { subtotal: d(p.subtotal), discount: d(p.discount), shipping: d(p.shipping), duty: d(p.duty), vat: d(p.vat), dueAtDoor: d(p.dueAtDoor), total: d(p.total) };
};
