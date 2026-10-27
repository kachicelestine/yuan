import { domainError, err, ok, type Clock, type DomainError, type EventLog, type Result } from "@/shared/kernel";
import type { OrderRepository, ShipmentRepository } from "../domain/repositories";
import {
  allSettled,
  AUTO_CONFIRM_DAYS,
  confirmDelivery,
  openDispute,
  resolveDispute,
  adminRefund,
  ship,
  type DisputeReason,
  type OrderCompleted,
  type Shipment,
  type ShipmentError,
} from "../domain/shipment";
import { toShipmentView, type ShipmentView } from "./orders";

export type FulfilmentScope = { orders: OrderRepository; shipments: ShipmentRepository; events: EventLog };

export type FulfilmentDeps = {
  orders: OrderRepository;
  shipments: ShipmentRepository;
  uow: { run<T>(work: (scope: FulfilmentScope) => Promise<T>): Promise<T> };
  clock: Clock;
};

export type FulfilmentError = ShipmentError | DomainError<"not_found">;

/** An open dispute with what a moderator needs to decide it. */
export type DisputeView = ShipmentView & { orderId: string; orderNumber: string; buyerId: string; country: string; lines: { title: string; image: string; qty: number; unitPrice: number }[] };

const missing = () => err(domainError("not_found", "No such parcel."));

/** Shipping, confirming, disputing and settling parcels. */
export function makeFulfilment({ orders, shipments, uow, clock }: FulfilmentDeps) {
  /**
   * Saves a parcel's new state with its event, and closes the order once every parcel is
   * settled. The conditional transition makes OrderCompleted happen exactly once even if
   * two parcels settle at the same moment.
   */
  async function commit(next: Shipment, event: { type: string; at: Date }) {
    await uow.run(async (s) => {
      await s.shipments.save(next);
      await s.events.record(next.orderId, event);
      if (allSettled(await s.shipments.forOrder(next.orderId)) && (await s.orders.transition(next.orderId, "paid", "completed"))) {
        const done: OrderCompleted = { type: "OrderCompleted", orderId: next.orderId, at: event.at };
        await s.events.record(next.orderId, done);
      }
    });
  }

  return {
    async forOrder(orderId: string): Promise<ShipmentView[]> {
      return (await shipments.forOrder(orderId)).map(toShipmentView);
    },

    /** The shop sends its parcel. */
    async ship(sellerId: string, orderId: string, parcel: { carrier: string; tracking: string }): Promise<Result<ShipmentView, FulfilmentError>> {
      const s = await shipments.find(orderId, sellerId);
      if (!s) return missing();
      // A gift waits for its recipient's address.
      if (!(await orders.findById(orderId))?.address) return err(domainError("not_shippable", "Wait for the delivery address: the recipient hasn't added it yet."));
      const r = ship(s, parcel, clock.now());
      if (!r.ok) return r;
      await commit(r.value.shipment, r.value.event);
      return ok(toShipmentView(r.value.shipment));
    },

    /** The buyer says it arrived: the shop gets paid. */
    async confirm(buyerId: string, orderId: string, sellerId: string): Promise<Result<ShipmentView, FulfilmentError>> {
      const order = await orders.findById(orderId);
      const s = order?.buyerId === buyerId ? await shipments.find(orderId, sellerId) : null;
      if (!s) return missing();
      const r = confirmDelivery(s, "buyer", clock.now());
      if (!r.ok) return r;
      await commit(r.value.shipment, r.value.event);
      return ok(toShipmentView(r.value.shipment));
    },

    async dispute(buyerId: string, orderId: string, sellerId: string, reason: DisputeReason, note: string | null): Promise<Result<ShipmentView, FulfilmentError>> {
      const order = await orders.findById(orderId);
      const s = order?.buyerId === buyerId ? await shipments.find(orderId, sellerId) : null;
      if (!s) return missing();
      const r = openDispute(s, reason, note, clock.now());
      if (!r.ok) return r;
      await commit(r.value.shipment, r.value.event);
      return ok(toShipmentView(r.value.shipment));
    },

    async resolve(moderatorId: string, orderId: string, sellerId: string, outcome: "refund" | "release", note: string): Promise<Result<ShipmentView, FulfilmentError>> {
      const s = await shipments.find(orderId, sellerId);
      if (!s) return missing();
      const r = resolveDispute(s, outcome, note, moderatorId, clock.now());
      if (!r.ok) return r;
      await commit(r.value.shipment, r.value.event);
      return ok(toShipmentView(r.value.shipment));
    },

    /** An admin refunds an unsettled parcel outright (no dispute needed). */
    async refund(adminId: string, orderId: string, sellerId: string, note: string): Promise<Result<ShipmentView, FulfilmentError>> {
      const s = await shipments.find(orderId, sellerId);
      if (!s) return missing();
      const r = adminRefund(s, note, adminId, clock.now());
      if (!r.ok) return r;
      await commit(r.value.shipment, r.value.event);
      return ok(toShipmentView(r.value.shipment));
    },

    /** Background job: parcels shipped long ago that nobody confirmed or disputed. */
    async autoConfirm(limit = 100): Promise<number> {
      const now = clock.now();
      const due = await shipments.dueForAutoConfirm(new Date(now.getTime() - AUTO_CONFIRM_DAYS * 86_400_000), limit);
      let done = 0;
      for (const s of due) {
        const r = confirmDelivery(s, "auto", now);
        if (!r.ok) continue;
        await commit(r.value.shipment, r.value.event);
        done++;
      }
      return done;
    },

    async disputes(limit = 50): Promise<DisputeView[]> {
      const open = await shipments.disputed(limit);
      const views: DisputeView[] = [];
      for (const s of open) {
        const o = await orders.findById(s.orderId);
        if (!o) continue;
        views.push({
          ...toShipmentView(s),
          orderId: o.id,
          orderNumber: o.number,
          buyerId: o.buyerId,
          country: o.country,
          lines: o.lines.filter((l) => l.sellerId === s.sellerId).map((l) => ({ title: l.title, image: l.image, qty: l.qty, unitPrice: l.unitPrice / 100 })),
        });
      }
      return views;
    },
  };
}

export type Fulfilment = ReturnType<typeof makeFulfilment>;
