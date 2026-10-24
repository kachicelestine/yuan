// Public surface of the ordering context.
export { makeCheckout, MAX_LINES, pricingInDollars, type CheckoutDeps, type CheckoutError, type CheckoutRequest, type CheckoutResult } from "./application/checkout";
export { makeCart, type Cart, type CartLineView } from "./application/cart";
export { cartKey, MAX_CART_LINES, mergeCarts, normalizeCart, type CartItem } from "./domain/cart";
export { makeCancelUnpaidOrder, makeGetOrder, makeMarkOrderPaid, toOrderView, type OrderView } from "./application/orders";
export type { CatalogLine, CatalogLineError, CheckoutScope, CouponReservations, Destinations, OrderCatalog, PaymentRequest, PaymentRequester, RequestedPayment, UnitOfWork } from "./application/ports";
export { MAX_QTY, orderNumber, type Order, type OrderCancelled, type OrderLine, type OrderPaid, type OrderPlaced, type OrderStatus } from "./domain/order";
export { couponDiscount, priceOrder, SHIPPING_METHODS, type CouponRule, type Destination, type PricedLine, type Pricing, type ShippingMethod } from "./domain/pricing";
export type { CartRepository, CouponCatalog, OrderRepository } from "./domain/repositories";
