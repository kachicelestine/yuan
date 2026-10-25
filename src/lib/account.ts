// Account queries over the fixtures: check-in rewards and coupon copy.
import { products } from "@/fixtures/products";
import type { Coupon } from "./types";
import { checkinRewards, coupons, rewardStore } from "@/fixtures/account";

export { checkinRewards, coupons, rewardStore };

export function getCoupon(id: string) {
  return coupons.find((c) => c.id === id);
}

/**
 * The coupon in the wallet that saves the most on these lines: seller coupons count only
 * that seller's items, free-shipping coupons are worth the shipping.
 */
export function bestCoupon(walletIds: string[], lines: { slug: string; unitPrice: number; qty: number }[], shipping: number) {
  let best: { coupon: Coupon; discount: number } | null = null;
  for (const c of coupons.filter((x) => walletIds.includes(x.id))) {
    const base = lines.filter((l) => !c.sellerId || products.find((p) => p.slug === l.slug)?.sellerId === c.sellerId).reduce((n, l) => n + l.unitPrice * l.qty, 0);
    if (base < c.minSpend) continue;
    const discount = c.freeShipping ? shipping : c.percent ? base * c.value : c.value;
    if (discount > 0 && (!best || discount > best.discount)) best = { coupon: c, discount };
  }
  return best;
}
