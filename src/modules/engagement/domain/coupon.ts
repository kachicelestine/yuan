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

/** What an admin (platform coupons) or a shop (its own vouchers) fills in. Money is in dollars. */
export type CouponInput = Readonly<{
  kind: CouponKind;
  /** Dollars off for `amount`, a fraction (0.1 = 10%) for `percent`; ignored for free shipping. */
  value: number;
  minSpend: number;
  title: string;
  detail: string;
  /** How long it runs, from now. */
  days: number;
}>;

export type CouponError = DomainError<"invalid_coupon">;
export const MAX_COUPON_DAYS = 90;

const bad = (message: string) => err(domainError("invalid_coupon", message));

/**
 * A new coupon. A shop's voucher counts only that shop's items. An amount coupon can't be
 * worth more than the spend it needs, so it never pays a buyer to order.
 */
export function createCoupon(input: CouponInput, sellerId: string | null, id: string, now: Date): Result<Coupon, CouponError> {
  const title = input.title.trim();
  const detail = input.detail.trim();
  if (title.length < 2 || title.length > 40) return bad("Give it a short title, like “$5 off”.");
  if (detail.length > 120) return bad("Keep the detail under 120 characters.");
  if (!Number.isFinite(input.minSpend) || input.minSpend < 0 || input.minSpend > 10_000) return bad("Minimum spend is between $0 and $10,000.");
  if (!Number.isInteger(input.days) || input.days < 1 || input.days > MAX_COUPON_DAYS) return bad(`It runs between 1 and ${MAX_COUPON_DAYS} days.`);
  let value = 0;
  if (input.kind === "amount") {
    value = Math.round(input.value * 100);
    if (!Number.isFinite(value) || value < 100 || value > 50_000) return bad("Amount off is between $1 and $500.");
    if (value > Math.round(input.minSpend * 100)) return bad("The amount off can't be more than the minimum spend.");
  } else if (input.kind === "percent") {
    value = Math.round(input.value * 100) / 100;
    if (!Number.isFinite(value) || value < 0.01 || value > 0.8) return bad("Percent off is between 1% and 80%.");
  }
  return ok({
    id,
    kind: input.kind,
    value,
    minSpend: Math.round(input.minSpend * 100) as Cents,
    sellerId,
    title,
    detail: detail || (sellerId ? "On this shop's items" : "On any order"),
    expiresAt: new Date(now.getTime() + input.days * 86_400_000),
  });
}

/** Stops a coupon now. Claims already in wallets stop working with it. */
export const endCoupon = (c: Coupon, now: Date): Coupon => (isExpired(c, now) ? c : { ...c, expiresAt: now });
