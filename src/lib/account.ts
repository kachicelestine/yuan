// Account helpers: check-in reward copy (fixtures) and choosing the best coupon.
import type { Coupon } from "./types";
import { checkinRewards, rewardStore } from "@/fixtures/account";

export { checkinRewards, rewardStore };

/**
 * The coupon in the wallet that saves the most on these lines: a shop's voucher counts only
 * that shop's items, free-shipping coupons are worth the shipping. Checkout reprices on the
 * server; this is the preview, and picks which coupon to send.
 */
export function bestCoupon(wallet: readonly Coupon[], lines: { unitPrice: number; qty: number; sellerId?: string }[], shipping: number) {
  let best: { coupon: Coupon; discount: number } | null = null;
  for (const c of wallet) {
    const base = lines.filter((l) => !c.sellerId || l.sellerId === c.sellerId).reduce((n, l) => n + l.unitPrice * l.qty, 0);
    if (base < c.minSpend) continue;
    const discount = c.freeShipping ? shipping : c.percent ? base * c.value : c.value;
    if (discount > 0 && (!best || discount > best.discount)) best = { coupon: c, discount };
  }
  return best;
}
