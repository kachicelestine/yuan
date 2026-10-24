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
  return shop ? { account, sellerId: shop.sellerId, role: shop.role } : null;
}
