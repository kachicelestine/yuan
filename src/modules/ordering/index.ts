// Public surface of the ordering context.
export { makeCheckout, MAX_LINES, pricingInDollars, type CheckoutDeps, type CheckoutError, type CheckoutRequest, type CheckoutResult } from "./application/checkout";
export { makeCart, type Cart, type CartLineView } from "./application/cart";
export { cartKey, MAX_CART_LINES, mergeCarts, normalizeCart, type CartItem } from "./domain/cart";
export { makeCancelUnpaidOrder, makeGetOrder, makeMarkOrderPaid, makeSellerOrders, toOrderView, type OrderView, type SellerOrderView } from "./application/orders";
export type { CatalogLine, CatalogLineError, CheckoutScope, CouponReservations, Destinations, OrderCatalog, PaymentRequest, PaymentRequester, PriceHold, PriceHolds, RequestedPayment, UnitOfWork } from "./application/ports";
export { holdCovers } from "./application/ports";
export { MAX_QTY, orderNumber, type Order, type OrderCancelled, type OrderLine, type OrderPaid, type OrderPlaced, type OrderStatus } from "./domain/order";
export { couponDiscount, priceOrder, SHIPPING_METHODS, type CouponRule, type Destination, type PricedLine, type Pricing, type ShippingMethod } from "./domain/pricing";
export type { CartRepository, CouponCatalog, OrderRepository, ShipmentRepository } from "./domain/repositories";
export { makeFulfilment, type DisputeView, type Fulfilment, type FulfilmentDeps, type FulfilmentError, type FulfilmentScope } from "./application/fulfilment";
export { toShipmentView, type ShipmentView } from "./application/orders";
export {
  allSettled,
  AUTO_CONFIRM_DAYS,
  CARRIERS,
  confirmDelivery,
  DISPUTE_REASONS,
  openDispute,
  openShipments,
  resolveDispute,
  ship,
  SHIPMENT_STATUSES,
  type DisputeOpened,
  type DisputeReason,
  type OrderCompleted,
  type Shipment,
  type ShipmentDelivered,
  type ShipmentError,
  type ShipmentRefunded,
  type ShipmentShipped,
  type ShipmentStatus,
} from "./domain/shipment";
