import type { PurchaseDirectory } from "@/modules/content";
import type { AccountRepository } from "@/modules/identity/domain/repositories";
import type { Onboarding } from "@/modules/merchants";
import type { EmailDirectory } from "@/modules/notifications";
import type { OrderRepository } from "@/modules/ordering";
import type { ShipmentRepository } from "@/modules/ordering/domain/repositories";
import type { OrderTotals, PayoutWallets } from "@/modules/payments";

// Small read-only bridges between contexts, so none of them reads another's tables.

/** Payments closes escrow knowing the lines' total and the coupon. */
export class OrderingTotals implements OrderTotals {
  constructor(private readonly orders: OrderRepository) {}

  async find(orderId: string) {
    const o = await this.orders.findById(orderId);
    return o && { buyerId: o.buyerId, subtotal: o.pricing.subtotal, discount: o.pricing.discount };
  }
}

/** Content lets people review what was delivered to them. */
export class OrderingPurchases implements PurchaseDirectory {
  constructor(
    private readonly orders: OrderRepository,
    private readonly shipments: ShipmentRepository,
  ) {}

  async delivered(buyerId: string, orderId: string, productSlug: string) {
    const o = await this.orders.findById(orderId);
    const line = o?.buyerId === buyerId ? o.lines.find((l) => l.slug === productSlug) : undefined;
    if (!o || !line) return null;
    const parcel = await this.shipments.find(orderId, line.sellerId);
    return parcel?.status === "delivered" ? { sellerId: line.sellerId, country: o.country } : null;
  }
}

/** Payouts go to the wallet the shop gave when it applied. */
export class MerchantWallets implements PayoutWallets {
  constructor(private readonly onboarding: () => Onboarding) {}

  forSeller(sellerId: string) {
    return this.onboarding().payoutWallet(sellerId);
  }
}

/** Notifications email people at their sign-in address. */
export class IdentityEmails implements EmailDirectory {
  constructor(private readonly accounts: AccountRepository) {}

  async emailOf(accountId: string) {
    return (await this.accounts.findById(accountId))?.email ?? null;
  }
}
