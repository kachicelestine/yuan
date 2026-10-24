import { domainError, err, ok, type Clock, type EventLog, type Result } from "@/shared/kernel";
import { cancelUnpaid, markPaid, type Order, type OrderError, type OrderStatus } from "../domain/order";
import type { OrderRepository, ShipmentRepository } from "../domain/repositories";
import { AUTO_CONFIRM_DAYS, openShipments, type Shipment } from "../domain/shipment";
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
  lines: { slug: string; title: string; image: string; option: string | null; unitPrice: number; qty: number; sellerId: string }[];
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
  lines: o.lines.map((l) => ({ slug: l.slug, title: l.title, image: l.image, option: l.option, unitPrice: l.unitPrice / 100, qty: l.qty, sellerId: l.sellerId })),
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
    /** For background work acting on the platform's behalf (notifications); never for a request. */
    async internal(id: string): Promise<OrderView | null> {
      const o = await deps.orders.findById(id);
      return o && toOrderView(o);
    },
  };
}

/** Marks an order paid once its invoice is settled, and opens a parcel per shop. Called inside the payment's transaction. */
export function makeMarkOrderPaid(deps: { orders: OrderRepository; shipments: ShipmentRepository; events: EventLog }) {
  return async (orderId: string, at: Date): Promise<Result<Order, OrderError | ReturnType<typeof domainError<"not_found">>>> => {
    const order = await deps.orders.findById(orderId);
    if (!order) return err(domainError("not_found", `Order ${orderId} not found.`));
    const r = markPaid(order, at);
    if (!r.ok) return r;
    if (r.value.event) {
      await deps.orders.save(r.value.order);
      for (const s of openShipments(r.value.order)) await deps.shipments.save(s);
      await deps.events.record(order.id, r.value.event);
    }
    return ok(r.value.order);
  };
}

/** Cancels an order whose payment window lapsed. Called inside the invoice's transaction. */
export function makeCancelUnpaidOrder(deps: { orders: OrderRepository; events: EventLog; clock: Clock }) {
  return async (orderId: string): Promise<Result<Order, OrderError | ReturnType<typeof domainError<"not_found">>>> => {
    const order = await deps.orders.findById(orderId);
    if (!order) return err(domainError("not_found", `Order ${orderId} not found.`));
    const r = cancelUnpaid(order, deps.clock.now());
    if (!r.ok) return r;
    if (r.value.event) {
      await deps.orders.save(r.value.order);
      await deps.events.record(order.id, r.value.event);
    }
    return ok(r.value.order);
  };
}

/** An order as a shop sees it: only its own lines, and no buyer identity beyond the country. */
export type SellerOrderView = {
  id: string;
  number: string;
  status: OrderStatus;
  country: string;
  shippingMethod: string;
  placedAt: string;
  paidAt: string | null;
  lines: OrderView["lines"];
  /** What this shop's lines come to, in dollars, before platform fees. */
  subtotal: number;
  /** This shop's parcel (paid orders only). */
  shipment: ShipmentView | null;
};

/** A parcel as buyers and shops see it. */
export type ShipmentView = {
  sellerId: string;
  status: Shipment["status"];
  amount: number;
  carrier: string | null;
  tracking: string | null;
  shippedAt: string | null;
  deliveredAt: string | null;
  confirmedBy: Shipment["confirmedBy"];
  /** When it confirms itself if nobody acts. */
  autoConfirmAt: string | null;
  dispute: { reason: string; note: string | null; openedAt: string } | null;
  resolution: { outcome: "refund" | "release"; note: string; at: string } | null;
};

export const toShipmentView = (s: Shipment): ShipmentView => ({
  sellerId: s.sellerId,
  status: s.status,
  amount: s.amount / 100,
  carrier: s.carrier,
  tracking: s.tracking,
  shippedAt: s.shippedAt?.toISOString() ?? null,
  deliveredAt: s.deliveredAt?.toISOString() ?? null,
  confirmedBy: s.confirmedBy,
  autoConfirmAt: s.status === "shipped" && s.shippedAt ? new Date(s.shippedAt.getTime() + AUTO_CONFIRM_DAYS * 86_400_000).toISOString() : null,
  dispute: s.dispute && { reason: s.dispute.reason, note: s.dispute.note, openedAt: s.dispute.openedAt.toISOString() },
  resolution: s.resolution && { outcome: s.resolution.outcome, note: s.resolution.note, at: s.resolution.at.toISOString() },
});

/** A shop's orders. Other shops' lines in the same order stay hidden. */
export function makeSellerOrders(deps: { orders: OrderRepository; shipments: ShipmentRepository }) {
  return {
    async list(sellerId: string, limit = 100): Promise<SellerOrderView[]> {
      const list = await deps.orders.listBySeller(sellerId, ["paid", "awaiting_payment", "completed"], limit);
      const parcels = await Promise.all(list.map((o) => deps.shipments.find(o.id, sellerId)));
      return list.map((o, i) => {
        const lines = o.lines.filter((l) => l.sellerId === sellerId);
        return {
          id: o.id,
          number: o.number,
          status: o.status,
          country: o.country,
          shippingMethod: o.shippingMethod,
          placedAt: o.placedAt.toISOString(),
          paidAt: o.paidAt?.toISOString() ?? null,
          lines: lines.map((l) => ({ slug: l.slug, title: l.title, image: l.image, option: l.option, unitPrice: l.unitPrice / 100, qty: l.qty, sellerId: l.sellerId })),
          subtotal: lines.reduce((n, l) => n + l.unitPrice * l.qty, 0) / 100,
          shipment: parcels[i] ? toShipmentView(parcels[i]) : null,
        };
      });
    },
  };
}
