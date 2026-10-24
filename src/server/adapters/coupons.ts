import type { Engagement } from "@/modules/engagement";
import type { CouponCatalog, CouponRule } from "@/modules/ordering";
import { money } from "@/shared/kernel";

/** Lets checkout use the coupons in a buyer's wallet (ordering never reads engagement tables itself). */
export class WalletCoupons implements CouponCatalog {
  constructor(private readonly engagement: Pick<Engagement, "usableCoupon">) {}

  async findUsable(buyerId: string, couponId: string): Promise<CouponRule | null> {
    const c = await this.engagement.usableCoupon(buyerId, couponId);
    if (!c) return null;
    return { id: c.id, kind: c.kind, value: c.kind === "amount" ? money.cents(Math.round(c.value)) : c.value, minSpend: c.minSpend, sellerId: c.sellerId };
  }
}
