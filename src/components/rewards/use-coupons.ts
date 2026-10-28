"use client";

import { useEffect, useState } from "react";
import type { Coupon } from "@/lib/types";
import type { CouponView } from "@/modules/engagement";

/** The server's coupon, in the shape the screens use (dollars, flags, a short end date). */
export function toCoupon(c: CouponView): Coupon {
  return {
    id: c.id,
    title: c.title,
    detail: c.detail,
    value: c.kind === "free_shipping" ? 0 : c.value,
    ...(c.kind === "percent" && { percent: true }),
    ...(c.kind === "free_shipping" && { freeShipping: true }),
    minSpend: c.minSpend,
    ...(c.sellerId && { sellerId: c.sellerId }),
    expires: new Date(c.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
    expiresAt: c.expiresAt,
  };
}

const cache = new Map<string, Promise<Coupon[]>>();

/** Forgets fetched coupons (after claiming one, so the next read is fresh). */
export const forgetCoupons = () => cache.clear();

function load(query: string): Promise<Coupon[]> {
  let hit = cache.get(query);
  if (!hit) {
    hit = fetch(`/api/coupons?${query}`)
      .then((r) => (r.ok ? (r.json() as Promise<{ coupons: CouponView[] }>) : { coupons: [] }))
      .then((r) => r.coupons.map(toCoupon))
      .catch(() => {
        cache.delete(query);
        return [];
      });
    cache.set(query, hit);
  }
  return hit;
}

/**
 * Coupons from the server: by id (a wallet), the platform's open ones, or a shop's vouchers.
 * Null until they arrive.
 */
export function useCoupons(params: { ids?: readonly string[]; open?: boolean; seller?: string } | null): Coupon[] | null {
  const query = params
    ? [params.ids?.length ? `ids=${[...params.ids].sort().map(encodeURIComponent).join(",")}` : "", params.open ? "open=1" : "", params.seller ? `seller=${encodeURIComponent(params.seller)}` : ""].filter(Boolean).join("&")
    : "";
  const [state, setState] = useState<{ query: string; coupons: Coupon[] } | null>(null);
  useEffect(() => {
    if (!query) return;
    let live = true;
    void load(query).then((coupons) => live && setState({ query, coupons }));
    return () => {
      live = false;
    };
  }, [query]);
  if (!query) return [];
  return state?.query === query ? state.coupons : null;
}
