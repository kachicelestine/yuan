import { domainError, err, ok, type Clock, type DomainError, type Result } from "@/shared/kernel";
import { createCoupon, endCoupon, type CouponError, type CouponInput } from "../domain/coupon";
import type { ClaimRepository, CouponRepository } from "../domain/repositories";
import { toCouponView, type CouponView } from "./engagement";

export type CouponDeskDeps = {
  coupons: CouponRepository;
  claims: Pick<ClaimRepository, "stats">;
  clock: Clock;
  newId: () => string;
};

/** A coupon with how far it has gone, for the people who run it. */
export type ManagedCouponView = CouponView & { claimed: number; used: number; running: boolean };

/**
 * Issuing and ending coupons. Admins issue platform coupons (and may end any); a shop
 * issues vouchers that count only its own items, and ends only its own.
 */
export function makeCouponDesk(d: CouponDeskDeps) {
  async function managed(list: Awaited<ReturnType<CouponRepository["list"]>>): Promise<ManagedCouponView[]> {
    const stats = await d.claims.stats(list.map((c) => c.id));
    const now = d.clock.now();
    return list.map((c) => ({ ...toCouponView(c), claimed: stats.get(c.id)?.claimed ?? 0, used: stats.get(c.id)?.used ?? 0, running: now < c.expiresAt }));
  }

  return {
    /** sellerId null issues a platform coupon (admins only; the caller checks). */
    async issue(sellerId: string | null, input: CouponInput): Promise<Result<CouponView, CouponError>> {
      // The random tail of the id (its head is a timestamp, shared by coupons made together).
      const id = `${sellerId ? "shop" : "ly"}-${d.newId().replace(/-/g, "").slice(-12)}`;
      const r = createCoupon(input, sellerId, id, d.clock.now());
      if (!r.ok) return r;
      await d.coupons.save(r.value);
      return ok(toCouponView(r.value));
    },

    /** Ends a coupon now. A shop (sellerId set) can end only its own; admins pass null. */
    async end(couponId: string, sellerId: string | null): Promise<Result<CouponView, DomainError<"not_found">>> {
      const c = await d.coupons.find(couponId);
      if (!c || (sellerId !== null && c.sellerId !== sellerId)) return err(domainError("not_found", "No such coupon."));
      const ended = endCoupon(c, d.clock.now());
      await d.coupons.save(ended);
      return ok(toCouponView(ended));
    },

    /** A shop's vouchers, newest first. */
    async forSeller(sellerId: string): Promise<ManagedCouponView[]> {
      return managed(await d.coupons.listForSeller(sellerId));
    },

    /** Every coupon, running ones first. */
    async all(): Promise<ManagedCouponView[]> {
      const list = await managed(await d.coupons.list());
      return list.sort((a, z) => Number(z.running) - Number(a.running) || z.expiresAt.localeCompare(a.expiresAt));
    },

    /** These coupons (for a wallet), running or not; unknown ids drop out. */
    async byIds(ids: readonly string[]): Promise<CouponView[]> {
      return (await d.coupons.findMany(ids)).map(toCouponView);
    },

    /** Platform coupons anyone can claim right now. */
    async openPlatform(): Promise<CouponView[]> {
      const now = d.clock.now();
      return (await d.coupons.list()).filter((c) => c.sellerId === null && now < c.expiresAt).map(toCouponView);
    },

    /** A shop's vouchers a buyer can claim right now (store and product pages). */
    async runningForSeller(sellerId: string): Promise<CouponView[]> {
      const now = d.clock.now();
      return (await d.coupons.listForSeller(sellerId)).filter((c) => now < c.expiresAt).map(toCouponView);
    },
  };
}

export type CouponDesk = ReturnType<typeof makeCouponDesk>;
