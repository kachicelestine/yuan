import { domainError, err, ok, type Cents, type DomainError, type Result } from "@/shared/kernel";

export type CouponKind = "amount" | "percent" | "free_shipping";

/** A promotion anyone can claim into their wallet, once. */
export type Coupon = Readonly<{
  id: string;
  kind: CouponKind;
  /** Cents for `amount`, a fraction for `percent`; ignored for free shipping. */
  value: number;
  minSpend: Cents;
  /** Only this seller's items count towards it, when set. */
  sellerId: string | null;
  title: string;
  detail: string;
  expiresAt: Date;
}>;

/**
 * A coupon in a buyer's wallet. Checkout reserves it for one order; payment spends it;
 * an order that lapses unpaid gives it back.
 */
export type Claim = Readonly<{
  accountId: string;
  couponId: string;
  claimedAt: Date;
  /** The order it's reserved for, if any. */
  orderId: string | null;
  redeemedAt: Date | null;
}>;

export type ClaimError = DomainError<"coupon_expired" | "unknown_coupon">;

export const isExpired = (c: Coupon, now: Date) => now >= c.expiresAt;

export function claim(coupon: Coupon | null, accountId: string, now: Date): Result<Claim, ClaimError> {
  if (!coupon) return err(domainError("unknown_coupon", "That coupon doesn't exist."));
  if (isExpired(coupon, now)) return err(domainError("coupon_expired", "That coupon has ended."));
  return ok({ accountId, couponId: coupon.id, claimedAt: now, orderId: null, redeemedAt: null });
}

/** Usable now: unexpired, not reserved by another order and not yet spent. */
export const isUsable = (c: Claim, coupon: Coupon, now: Date) => !c.orderId && !c.redeemedAt && !isExpired(coupon, now);
