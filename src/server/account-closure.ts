import "server-only";
import { accountData } from "./account-data";
import type { Services } from "./container";

type App = Pick<Services, "accounts" | "cart" | "engagement" | "fulfilment" | "getOrder" | "identity" | "messaging" | "notifications" | "onboarding" | "profiles">;

/** Parcels still moving, or money still held: the account has to stay until they settle. */
const OPEN_PARCELS = new Set(["awaiting_shipment", "shipped", "disputed"]);

/** Everything we hold about someone that they can take away with them. */
export async function exportAccount(app: App, accountId: string, identity: { email: string | null; wallet: string | null }) {
  const [state, profile, orders, conversations, memberships] = await Promise.all([
    accountData(app).load(accountId),
    app.profiles.me(accountId),
    app.getOrder.list(accountId, 1000),
    app.messaging.buyerInbox(accountId, 500),
    app.onboarding.memberships(accountId),
  ]);
  const threads = await Promise.all(conversations.map((c) => app.messaging.thread(c.id, { side: "buyer", accountId, name: "" })));
  return {
    exportedAt: new Date().toISOString(),
    account: { id: accountId, ...identity, market: state.market },
    profile,
    orders,
    bag: state.cart,
    saved: state.saved,
    alerts: state.alerts,
    watches: state.watches,
    following: state.following,
    coupons: state.coupons,
    coins: state.coins,
    messages: threads.filter(Boolean),
    shops: memberships,
  };
}

/** Why this account can't close yet, in words for its owner, or null when it can. */
export async function closureBlock(app: App, accountId: string): Promise<string | null> {
  const memberships = await app.onboarding.memberships(accountId);
  if (memberships.some((m) => m.role === "owner")) return "You own a shop. Get in touch and we'll close it with you first, so buyers and payouts aren't left waiting.";
  const orders = await app.getOrder.list(accountId, 200);
  const parcels = await Promise.all(orders.filter((o) => o.status === "paid").map((o) => app.fulfilment.forOrder(o.id)));
  if (parcels.flat().some((p) => OPEN_PARCELS.has(p.status))) return "You have an order on its way. You can close your account once it's confirmed or settled.";
  return null;
}

/**
 * Closes an account: sign-in details, profile, bag and lists are gone, and every device is
 * signed out. Order records stay, without a way back to the person's login, because tax law
 * requires them.
 */
export async function closeAccount(app: App, accountId: string) {
  await accountData(app).save(accountId, { cart: [], saved: [], alerts: [], watches: [], following: [] });
  await app.profiles.close(accountId);
  await app.notifications.forgetDevices(accountId);
  await app.identity.close(accountId);
}
