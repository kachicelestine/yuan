import { domainError, err, ok, type Cents, type Clock, type DomainError, type Result } from "@/shared/kernel";
import { placeOrder, type OrderError } from "../domain/order";
import type { Pricing } from "../domain/pricing";
import type { OrderRepository } from "../domain/repositories";
import type { CatalogLineError, CheckoutScope, Destinations, OrderCatalog, UnitOfWork } from "./ports";

export type DepositRequest = Readonly<{
  buyerId: string;
  /** The listing the deposit goes toward. */
  slug: string;
  /** What the shop asks now, set by the pre-order or pre-sale (never by the browser). */
  amount: Cents;
  country: string;
  rail: string;
}>;

export type DepositError = CatalogLineError | OrderError | DomainError<"unknown_country" | "invalid_amount" | "rail_unavailable">;

export type DepositResult = Readonly<{ orderId: string; orderNumber: string; invoiceId: string; total: Cents }>;

/**
 * A deposit: an order of one line at the deposit amount, with nothing to ship and no
 * shipping or duties. Its money waits in Protect for the order it goes toward.
 */
export function makeDepositCheckout(deps: { catalog: OrderCatalog; destinations: Destinations; uow: UnitOfWork<CheckoutScope>; clock: Clock; newId: () => string; newOrderNumber: () => string }) {
  return async function depositCheckout(req: DepositRequest): Promise<Result<DepositResult, DepositError>> {
    if (!Number.isInteger(req.amount) || req.amount < 1) return err(domainError("invalid_amount", "The deposit amount is wrong."));
    const destination = await deps.destinations.find(req.country);
    if (!destination) return err(domainError("unknown_country", `We can't deliver to "${req.country}" yet.`));
    const priced = await deps.catalog.priceLine(req.slug, null, 1);
    if (!priced.ok) return priced;
    const c = priced.value;
    const pricing: Pricing = { subtotal: req.amount, discount: 0 as Cents, shipping: 0 as Cents, duty: 0 as Cents, vat: 0 as Cents, dueAtDoor: 0 as Cents, total: req.amount, parcels: 0, couponId: null, fundedBy: null };
    const placed = placeOrder({
      id: deps.newId(),
      number: deps.newOrderNumber(),
      buyerId: req.buyerId,
      country: destination.country,
      address: null,
      shippingMethod: "standard",
      lines: [{ productId: c.productId, slug: c.slug, title: `Deposit: ${c.title}`, image: c.image, sellerId: c.sellerId, option: null, unitPrice: req.amount, qty: 1 }],
      pricing,
      at: deps.clock.now(),
      kind: "deposit",
    });
    if (!placed.ok) return placed;
    const { order, event } = placed.value;
    return deps.uow
      .run(async ({ orders, payments, events }) => {
        await orders.save(order);
        await events.record(order.id, event);
        const payment = await payments.request({ orderId: order.id, amount: req.amount, rail: req.rail });
        if (!payment.ok) throw new DepositAbort(payment.error);
        return ok({ orderId: order.id, orderNumber: order.number, invoiceId: payment.value.invoiceId, total: req.amount });
      })
      .catch((e: unknown) => {
        if (e instanceof DepositAbort) return err(e.error);
        throw e;
      });
  };
}

class DepositAbort extends Error {
  constructor(readonly error: DomainError<"rail_unavailable" | "invalid_amount">) {
    super(error.message);
  }
}

/** A deposit order whose money has gone on (to the shop, or back to the buyer) is done. */
export function makeCloseDeposit(deps: { orders: OrderRepository }) {
  return (orderId: string) => deps.orders.transition(orderId, "paid", "completed");
}
