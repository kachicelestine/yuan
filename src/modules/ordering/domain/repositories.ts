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
