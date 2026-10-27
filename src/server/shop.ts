import "server-only";
import { cache } from "react";
import type { Membership } from "@/modules/merchants";
import { services } from "./container";
import { currentAccount } from "./session";

/** The shops the signed-in person runs (usually one), for this request. */
export const myShops = cache(async (): Promise<Membership[]> => {
  const account = await currentAccount();
  return account ? (await services()).onboarding.memberships(account.id) : [];
});

/**
 * The signed-in person's shop: the one asked for, or their first. Null when they don't
 * run it, so seller actions can't touch another shop's listings.
 */
export async function currentShop(sellerId?: string) {
  const account = await currentAccount();
  if (!account) return null;
  const shops = await myShops();
  const shop = sellerId ? shops.find((m) => m.sellerId === sellerId) : shops[0];
  if (!shop) return null;
  // A suspended shop's tools are locked.
  if (await (await services()).catalog.suspension(shop.sellerId)) return null;
  return { account, sellerId: shop.sellerId, role: shop.role };
}

/** The signed-in person's shop when an admin suspended it: its id and the reason. */
export async function suspendedShop() {
  const [shop] = await myShops();
  if (!shop) return null;
  const s = await (await services()).catalog.suspension(shop.sellerId);
  return s ? { sellerId: shop.sellerId, ...s } : null;
}
