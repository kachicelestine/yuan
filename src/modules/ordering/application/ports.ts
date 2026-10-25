import type { Cents, DomainError, EventLog, Result } from "@/shared/kernel";
import type { OrderRepository } from "../domain/repositories";
import type { Destination } from "../domain/pricing";

/** A product as checkout needs it, priced by the catalog for a quantity and option. */
export type CatalogLine = Readonly<{
  productId: string;
  slug: string;
  title: string;
  image: string;
  sellerId: string;
  /** Null for a listing sold by quote: only a held price (an accepted quote) can buy it. */
  unitPrice: Cents | null;
  minOrder: number;
  dutyRate: number;
  shipsFrom: string;
}>;

export type CatalogLineError = DomainError<"unknown_product" | "quote_only" | "unknown_option">;

export interface OrderCatalog {
  /** Prices `qty` of a product with the chosen option labels ("M · Ink"), or explains why it can't. */
  priceLine(slug: string, option: string | null, qty: number): Promise<Result<CatalogLine, CatalogLineError>>;
}

/** A special price one buyer holds, for up to `qty` units (and at least `minQty`). */
export type PriceHold = Readonly<{ price: Cents; qty: number; minQty?: number }>;

/** Special prices one buyer holds (a live price they tapped, an auction they won, a quote they accepted). */
export interface PriceHolds {
  /** The lowest held price that applies to buying `qty` units. */
  best(buyerId: string, slug: string, qty: number): Promise<PriceHold | null>;
}

/** Whether a hold covers buying `qty` units. */
export const holdCovers = (h: PriceHold, qty: number) => qty <= h.qty && qty >= (h.minQty ?? 1);

export interface Destinations {
  find(country: string): Promise<Destination | null>;
}

export type PaymentRequest = Readonly<{ orderId: string; amount: Cents; rail: string }>;
export type RequestedPayment = Readonly<{ invoiceId: string }>;

/** Opens an invoice for an order (implemented by the payments module). */
export interface PaymentRequester {
  request(req: PaymentRequest): Promise<Result<RequestedPayment, DomainError<"rail_unavailable" | "invalid_amount">>>;
}

/** Runs work in one database transaction; everything it saves commits or rolls back together. */
export interface UnitOfWork<Scope> {
  run<T>(work: (scope: Scope) => Promise<T>): Promise<T>;
}

/** Holds a coupon for one order, atomically (implemented by the engagement module). */
export interface CouponReservations {
  /** True when this order got the coupon; false if it's gone or used. */
  reserve(buyerId: string, couponId: string, orderId: string): Promise<boolean>;
}

export type CheckoutScope = { orders: OrderRepository; payments: PaymentRequester; coupons: CouponReservations; events: EventLog };
