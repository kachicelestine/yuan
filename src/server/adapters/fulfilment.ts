import type { Affiliates, OrderSource } from "@/modules/affiliates";
import type { PurchaseDirectory } from "@/modules/content";
import type { AccountRepository } from "@/modules/identity/domain/repositories";
import type { Onboarding } from "@/modules/merchants";
import type { EmailDirectory } from "@/modules/notifications";
import type { OrderRepository } from "@/modules/ordering";
import type { ShipmentRepository } from "@/modules/ordering/domain/repositories";
import type { OrderTotals, PayoutWallets } from "@/modules/payments";
import { cents } from "@/shared/kernel/money";

// Small read-only bridges between contexts, so none of them reads another's tables.

/** Payments closes escrow knowing the lines' total and the coupon. */
export class OrderingTotals implements OrderTotals {
  constructor(private readonly orders: OrderRepository) {}

  async find(orderId: string) {
    const o = await this.orders.findById(orderId);
    return o && { buyerId: o.buyerId, subtotal: o.pricing.subtotal, discount: o.pricing.discount, shopFunded: o.pricing.fundedBy !== null };
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

/** Shops are paid at the wallet they gave when they applied; creators at the one in their hub. */
export class MerchantWallets implements PayoutWallets {
  constructor(
    private readonly onboarding: () => Onboarding,
    private readonly affiliates: () => Affiliates,
  ) {}

  forSeller(sellerId: string) {
    return this.onboarding().payoutWallet(sellerId);
  }

  forCreator(accountId: string) {
    return this.affiliates().walletOf(accountId);
  }
}

/** Affiliates sees who bought, through which creator code, and what each shop sold. */
export class OrderingReferrals implements OrderSource {
  constructor(private readonly orders: OrderRepository) {}

  async find(orderId: string) {
    const o = await this.orders.findById(orderId);
    if (!o) return null;
    const shops = new Map<string, { sellerId: string; amount: number; slugs: string[] }>();
    for (const l of o.lines) {
      const shop = shops.get(l.sellerId) ?? { sellerId: l.sellerId, amount: 0, slugs: [] };
      shop.amount += l.unitPrice * l.qty;
      if (!shop.slugs.includes(l.slug)) shop.slugs.push(l.slug);
      shops.set(l.sellerId, shop);
    }
    return { buyerId: o.buyerId, referral: o.referral, shops: [...shops.values()].map((s) => ({ ...s, amount: cents(s.amount) })) };
  }
}

/** Notifications email people at their sign-in address. */
export class IdentityEmails implements EmailDirectory {
  constructor(private readonly accounts: AccountRepository) {}

  async emailOf(accountId: string) {
    return (await this.accounts.findById(accountId))?.email ?? null;
  }
}
