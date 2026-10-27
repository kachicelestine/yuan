import "server-only";
import type { AccountView } from "@/modules/identity";
import type { Actor } from "@/modules/content";
import { services } from "./container";

/**
 * How someone appears next to what they post: their profile's name and photo. Every
 * account has a profile (made with a default handle on first use), so nothing personal
 * like an email or wallet ever shows.
 */
export async function actorFor(account: AccountView): Promise<Actor> {
  const a = await (await services()).profiles.actor(account.id);
  return { accountId: account.id, name: a.name, avatar: a.avatar };
}
