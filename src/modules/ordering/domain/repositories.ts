import type { Shipment, ShipmentStatus } from "./shipment";
import type { CartItem } from "./cart";
import type { Order } from "./order";
import type { CouponRule } from "./pricing";

export interface OrderRepository {
  findById(id: string): Promise<Order | null>;
  findByNumber(number: string): Promise<Order | null>;
  /** A buyer's orders, newest first. */
  listByBuyer(buyerId: string, limit: number): Promise<Order[]>;
  /** Orders with at least one of the shop's lines, newest first (all lines included). */
  listBySeller(sellerId: string, statuses: readonly Order["status"][], limit: number): Promise<Order[]>;
  save(order: Order): Promise<void>;
  /** Moves an order between states only if it's still in `from`; false when someone else got there first. */
  transition(orderId: string, from: Order["status"], to: Order["status"]): Promise<boolean>;
}

export interface ShipmentRepository {
  forOrder(orderId: string): Promise<Shipment[]>;
  find(orderId: string, sellerId: string): Promise<Shipment | null>;
  save(shipment: Shipment): Promise<void>;
  /** A shop's parcels in these states, newest order first. */
  forSeller(sellerId: string, statuses: readonly ShipmentStatus[], limit: number): Promise<Shipment[]>;
  /** Shipped before `before` and never confirmed or disputed. */
  dueForAutoConfirm(before: Date, limit: number): Promise<Shipment[]>;
  /** Open disputes, oldest first. */
  disputed(limit: number): Promise<Shipment[]>;
}

export interface CartRepository {
  get(buyerId: string): Promise<CartItem[]>;
  replace(buyerId: string, items: readonly CartItem[]): Promise<void>;
}

/** Coupons a buyer holds (implemented by the engagement module). */
export interface CouponCatalog {
  /** The rule for a coupon in this buyer's wallet that they can use now, or null. */
  findUsable(buyerId: string, couponId: string): Promise<CouponRule | null>;
}
