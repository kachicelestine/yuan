import { domainError, err, money, ok, type Cents, type DomainError, type Result } from "@/shared/kernel";
import type { Order } from "./order";

// After payment, each shop in an order ships its own parcel. The buyer confirms it arrived
// (or it confirms itself after a while), which releases that shop's money from Protect.
// Before confirming, the buyer can open a dispute; a moderator then refunds or releases.

export const SHIPMENT_STATUSES = ["awaiting_shipment", "shipped", "delivered", "disputed", "refunded"] as const;
export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

export const DISPUTE_REASONS = ["not_arrived", "damaged", "not_as_described", "wrong_item", "other"] as const;
export type DisputeReason = (typeof DISPUTE_REASONS)[number];

/** Carriers a shop can pick when it ships; the shopper's chosen company comes first in the form. */
export const CARRIERS = ["DHL", "FedEx", "UPS", "Aramex", "SF International", "EMS", "China Post", "YunExpress", "4PX", "Cainiao", "J&T Express", "Speedaf", "Other"] as const;

/** Shipped parcels confirm themselves this long after shipping if the buyer says nothing. */
export const AUTO_CONFIRM_DAYS = 21;
/** A shop has this long after payment to ship a parcel; after that it's refunded. */
export const SHIP_WITHIN_DAYS = 15;
/** Who decided, when nobody did: the platform's own rules (a job). */
export const SYSTEM_ACTOR = "00000000-0000-0000-0000-000000000000";

export type Shipment = Readonly<{
  orderId: string;
  sellerId: string;
  status: ShipmentStatus;
  /** The shop's lines in the order: what Protect releases to it (before commission). */
  amount: Cents;
  carrier: string | null;
  tracking: string | null;
  shippedAt: Date | null;
  deliveredAt: Date | null;
  /** Who confirmed delivery. */
  confirmedBy: "buyer" | "auto" | "moderator" | null;
  dispute: Readonly<{ reason: DisputeReason; note: string | null; openedAt: Date }> | null;
  resolution: Readonly<{ outcome: "refund" | "release"; note: string; by: string; at: Date }> | null;
}>;

export type ShipmentShipped = Readonly<{ type: "ShipmentShipped"; orderId: string; sellerId: string; carrier: string; tracking: string; at: Date }>;
export type ShipmentDelivered = Readonly<{ type: "ShipmentDelivered"; orderId: string; sellerId: string; amount: Cents; by: "buyer" | "auto" | "moderator"; at: Date }>;
export type DisputeOpened = Readonly<{ type: "DisputeOpened"; orderId: string; sellerId: string; reason: DisputeReason; at: Date }>;
export type ShipmentRefunded = Readonly<{ type: "ShipmentRefunded"; orderId: string; sellerId: string; amount: Cents; at: Date }>;

export type ShipmentError = DomainError<"not_shippable" | "not_deliverable" | "not_disputable" | "not_disputed" | "invalid_tracking" | "invalid_note">;

/** One shipment per shop in a paid order, each owed its own lines' total. */
export function openShipments(order: Order): Shipment[] {
  // A deposit has nothing to ship; its money waits for the order it goes toward.
  if (order.kind === "deposit") return [];
  const bySeller = new Map<string, Cents>();
  for (const l of order.lines) bySeller.set(l.sellerId, money.add(bySeller.get(l.sellerId) ?? money.ZERO, money.cents(l.unitPrice * l.qty)));
  // A shop's own voucher comes out of what that shop is paid.
  const funder = order.pricing.fundedBy;
  if (funder && bySeller.has(funder)) bySeller.set(funder, money.max(money.ZERO, money.subtract(bySeller.get(funder)!, order.pricing.discount)));
  return [...bySeller].map(([sellerId, amount]) => ({
    orderId: order.id,
    sellerId,
    status: "awaiting_shipment",
    amount,
    carrier: null,
    tracking: null,
    shippedAt: null,
    deliveredAt: null,
    confirmedBy: null,
    dispute: null,
    resolution: null,
  }));
}

export function ship(s: Shipment, parcel: { carrier: string; tracking: string }, at: Date): Result<{ shipment: Shipment; event: ShipmentShipped }, ShipmentError> {
  if (s.status !== "awaiting_shipment") return err(domainError("not_shippable", "This parcel has already been sent."));
  const carrier = parcel.carrier.trim();
  const tracking = parcel.tracking.trim().toUpperCase();
  if (!carrier || carrier.length > 40) return err(domainError("invalid_tracking", "Pick the carrier."));
  if (!/^[A-Z0-9-]{6,40}$/.test(tracking)) return err(domainError("invalid_tracking", "Tracking numbers are 6 to 40 letters and digits."));
  return ok({
    shipment: { ...s, status: "shipped", carrier, tracking, shippedAt: at },
    event: { type: "ShipmentShipped", orderId: s.orderId, sellerId: s.sellerId, carrier, tracking, at },
  });
}

export function confirmDelivery(s: Shipment, by: "buyer" | "auto", at: Date): Result<{ shipment: Shipment; event: ShipmentDelivered }, ShipmentError> {
  if (s.status !== "shipped") return err(domainError("not_deliverable", s.status === "awaiting_shipment" ? "It hasn't shipped yet." : "This parcel is already settled."));
  return ok({ shipment: { ...s, status: "delivered", deliveredAt: at, confirmedBy: by }, event: { type: "ShipmentDelivered", orderId: s.orderId, sellerId: s.sellerId, amount: s.amount, by, at } });
}

export function openDispute(s: Shipment, reason: DisputeReason, note: string | null, at: Date): Result<{ shipment: Shipment; event: DisputeOpened }, ShipmentError> {
  if (s.status !== "awaiting_shipment" && s.status !== "shipped") return err(domainError("not_disputable", "This parcel is already settled. Message the seller instead."));
  const n = note?.trim() || null;
  if (n && n.length > 1000) return err(domainError("invalid_note", "Keep it under 1,000 characters."));
  if (reason === "other" && !n) return err(domainError("invalid_note", "Tell us what went wrong."));
  return ok({ shipment: { ...s, status: "disputed", dispute: { reason, note: n, openedAt: at } }, event: { type: "DisputeOpened", orderId: s.orderId, sellerId: s.sellerId, reason, at } });
}

/** A moderator decides: the buyer gets the shop's amount back, or the shop is paid. */
/**
 * An admin refunds a parcel that isn't settled yet (not shipped, on its way, or disputed),
 * for example when a shop is suspended or never ships.
 */
export function adminRefund(s: Shipment, note: string, by: string, at: Date): Result<{ shipment: Shipment; event: ShipmentRefunded }, ShipmentError> {
  if (s.status === "delivered" || s.status === "refunded") return err(domainError("not_disputable", "This parcel is already settled."));
  const n = note.trim();
  if (n.length < 5 || n.length > 1000) return err(domainError("invalid_note", "Explain the decision in a sentence: both sides see it."));
  return ok({ shipment: { ...s, status: "refunded", resolution: { outcome: "refund", note: n, by, at } }, event: { type: "ShipmentRefunded", orderId: s.orderId, sellerId: s.sellerId, amount: s.amount, at } });
}

export function resolveDispute(
  s: Shipment,
  outcome: "refund" | "release",
  note: string,
  by: string,
  at: Date,
): Result<{ shipment: Shipment; event: ShipmentRefunded | ShipmentDelivered }, ShipmentError> {
  if (s.status !== "disputed") return err(domainError("not_disputed", "There's no open dispute on this parcel."));
  const n = note.trim();
  if (n.length < 5 || n.length > 1000) return err(domainError("invalid_note", "Explain the decision in a sentence: both sides see it."));
  const resolution = { outcome, note: n, by, at };
  if (outcome === "refund") {
    return ok({ shipment: { ...s, status: "refunded", resolution }, event: { type: "ShipmentRefunded", orderId: s.orderId, sellerId: s.sellerId, amount: s.amount, at } });
  }
  return ok({
    shipment: { ...s, status: "delivered", deliveredAt: s.deliveredAt ?? at, confirmedBy: "moderator", resolution },
    event: { type: "ShipmentDelivered", orderId: s.orderId, sellerId: s.sellerId, amount: s.amount, by: "moderator", at },
  });
}

/** Every parcel is settled (delivered or refunded): the order is done and Protect can close. */
export const allSettled = (shipments: readonly Shipment[]) => shipments.length > 0 && shipments.every((s) => s.status === "delivered" || s.status === "refunded");

export type OrderCompleted = Readonly<{ type: "OrderCompleted"; orderId: string; at: Date }>;
