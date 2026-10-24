import { domainError, err, ok, type Result } from "@/shared/kernel";
import { cancelUnpaid, markPaid, type Order, type OrderError, type OrderStatus } from "../domain/order";
import type { OrderRepository } from "../domain/repositories";
import { pricingInDollars } from "./checkout";

export type OrderView = {
  id: string;
  number: string;
  buyerId: string;
  status: OrderStatus;
  country: string;
  shippingMethod: string;
  placedAt: string;
  paidAt: string | null;
  lines: { slug: string; title: string; image: string; option: string | null; unitPrice: number; qty: number }[];
  totals: ReturnType<typeof pricingInDollars>;
};

export const toOrderView = (o: Order): OrderView => ({
  id: o.id,
  number: o.number,
  buyerId: o.buyerId,
  status: o.status,
  country: o.country,
  shippingMethod: o.shippingMethod,
  placedAt: o.placedAt.toISOString(),
  paidAt: o.paidAt?.toISOString() ?? null,
  lines: o.lines.map((l) => ({ slug: l.slug, title: l.title, image: l.image, option: l.option, unitPrice: l.unitPrice / 100, qty: l.qty })),
  totals: pricingInDollars(o.pricing),
});

/**
 * Reads orders for the buyer who placed them. Someone else's order is reported as
 * missing, not forbidden, so order numbers can't be probed.
 */
export function makeGetOrder(deps: { orders: OrderRepository }) {
  const mine = (o: Order | null, buyerId: string) => (o && o.buyerId === buyerId ? toOrderView(o) : null);
  return {
    async byNumber(number: string, buyerId: string): Promise<OrderView | null> {
      return mine(await deps.orders.findByNumber(number.toUpperCase()), buyerId);
    },
    async byId(id: string, buyerId: string): Promise<OrderView | null> {
      return mine(await deps.orders.findById(id), buyerId);
    },
    async list(buyerId: string, limit = 20): Promise<OrderView[]> {
      return (await deps.orders.listByBuyer(buyerId, limit)).map(toOrderView);
    },
  };
}

/** Marks an order paid once its invoice is settled. Called inside the payment's transaction. */
export function makeMarkOrderPaid(deps: { orders: OrderRepository }) {
  return async (orderId: string, at: Date): Promise<Result<Order, OrderError | ReturnType<typeof domainError<"not_found">>>> => {
    const order = await deps.orders.findById(orderId);
    if (!order) return err(domainError("not_found", `Order ${orderId} not found.`));
    const r = markPaid(order, at);
    if (!r.ok) return r;
    if (r.value.event) await deps.orders.save(r.value.order);
    return ok(r.value.order);
  };
}

/** Cancels an order whose payment window lapsed. Called inside the invoice's transaction. */
export function makeCancelUnpaidOrder(deps: { orders: OrderRepository }) {
  return async (orderId: string): Promise<Result<Order, OrderError | ReturnType<typeof domainError<"not_found">>>> => {
    const order = await deps.orders.findById(orderId);
    if (!order) return err(domainError("not_found", `Order ${orderId} not found.`));
    const r = cancelUnpaid(order);
    if (r.ok && r.value !== order) await deps.orders.save(r.value);
    return r;
  };
}
