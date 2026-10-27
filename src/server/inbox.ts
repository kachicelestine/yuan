import "server-only";
import type { Party } from "@/modules/messaging";
import { actorFor } from "./actor";
import { services } from "./container";
import { currentAccount } from "./session";
import { currentShop } from "./shop";

/** Who is reading this conversation: its shopper, or someone at its shop. Null for anyone else. */
export async function messageParty(conversationId: string): Promise<Party | null> {
  const account = await currentAccount();
  if (!account) return null;
  const app = await services();
  if (await app.messaging.thread(conversationId, { side: "buyer", accountId: account.id, name: "" })) return { side: "buyer", ...(await actorFor(account)) };
  const shop = await currentShop();
  if (shop && (await app.messaging.thread(conversationId, { side: "shop", accountId: account.id, sellerId: shop.sellerId }))) return { side: "shop", accountId: account.id, sellerId: shop.sellerId };
  return null;
}
