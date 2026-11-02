// Public surface of the ordering context.
export { makeCheckout, MAX_LINES, pricingInDollars, type CheckoutDeps, type CheckoutError, type CheckoutRequest, type CheckoutResult } from "./application/checkout";
export { makeCart, type Cart, type CartLineView } from "./application/cart";
export { makeCloseDeposit, makeDepositCheckout, type DepositError, type DepositRequest, type DepositResult } from "./application/deposit-checkout";
export { cartKey, MAX_CART_LINES, mergeCarts, normalizeCart, type CartItem } from "./domain/cart";
export { makeCancelUnpaidOrder, makeGetOrder, makeMarkOrderPaid, makeSellerOrders, toOrderView, type OrderView, type SellerOrderView } from "./application/orders";
export type { CatalogLine, CatalogLineError, CheckoutScope, CouponReservations, DeliveryChoice, DeliveryQuotes, Destinations, OrderCatalog, PaymentRequest, PaymentRequester, PriceHold, PriceHolds, RequestedPayment, UnitOfWork } from "./application/ports";
export { holdCovers } from "./application/ports";
export { cleanAddress, type AddressError, type AddressInput, type ShippingAddress } from "./domain/address";
export { addressRules, type AddressRules } from "./domain/address-rules";
export { claimGift, createGift, GIFT_THANKS, GIFT_THEMES, thankSender, type Gift, type GiftClaimed, type GiftError, type GiftInput, type GiftTheme } from "./domain/gift";
export { giftSummary, makeGifts, type Gifts, type GiftScope, type GiftsDeps, type GiftState, type GiftSummary, type GiftView } from "./application/gifts";
export { MAX_QTY, ORDER_KINDS, orderNumber, type OrderKind, type Order, type OrderCancelled, type OrderDelivery, type OrderLine, type OrderPaid, type OrderPlaced, type OrderStatus } from "./domain/order";
export { couponDiscount, parcelWeights, priceOrder, SHIPPING_METHODS, type CouponRule, type Destination, type PricedLine, type Pricing, type ShippingMethod } from "./domain/pricing";
export type { CartRepository, CouponCatalog, GiftRepository, OrderRepository, ShipmentRepository } from "./domain/repositories";
export { makeFulfilment, type DisputeView, type Fulfilment, type FulfilmentDeps, type FulfilmentError, type FulfilmentScope } from "./application/fulfilment";
export { toShipmentView, type ShipmentView } from "./application/orders";
export {
  allSettled,
  AUTO_CONFIRM_DAYS,
  SHIP_WITHIN_DAYS,
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
