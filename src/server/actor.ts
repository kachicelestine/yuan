import "server-only";
import type { AccountView } from "@/modules/identity";
import type { Actor } from "@/modules/content";

/**
 * How someone appears next to what they post. Accounts only hold an email or a wallet,
 * neither of which belongs on a public page, so until profiles exist people show as a
 * stable handle made from their account id.
 */
export function actorFor(account: AccountView): Actor {
  return { accountId: account.id, name: `shopper-${account.id.replace(/-/g, "").slice(-6)}`, avatar: "" };
}
