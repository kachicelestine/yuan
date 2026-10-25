import "server-only";
import type { EngagementSnapshot, WatchView } from "@/modules/engagement";
import type { CartItem, CartLineView } from "@/modules/ordering";
import type { Services } from "./container";

/** Everything a signed-in buyer keeps on their account, as the device mirrors it. */
export type AccountState = EngagementSnapshot & { accountId: string; cart: CartLineView[] };

/** What a device sends: the parts the buyer edits freely. Coins never come from a device. */
export type DeviceData = { cart: CartItem[]; saved: string[]; alerts: string[]; watches: WatchView[]; following: string[] };

/** The account's items in their order, then the device's new ones. */
const union = (account: readonly string[], device: readonly string[]) => [...new Set([...account, ...device])];

/** Reads and writes the account side of what used to live only in the browser. */
export function accountData(app: Pick<Services, "cart" | "engagement">) {
  async function load(accountId: string): Promise<AccountState> {
    const [cart, engagement] = await Promise.all([app.cart.get(accountId), app.engagement.snapshot(accountId)]);
    return { accountId, cart, ...engagement };
  }

  return {
    load,

    /**
     * At sign-in on a device: the device's bag, lists and free coupons are folded into
     * the account. Items in both are kept once; a watch set on this device wins.
     */
    async merge(accountId: string, device: DeviceData & { coupons: string[] }): Promise<AccountState> {
      const current = await app.engagement.snapshot(accountId);
      await app.cart.merge(accountId, device.cart);
      await app.engagement.replaceLists(accountId, {
        saved: union(current.saved, device.saved),
        alerts: union(current.alerts, device.alerts),
        following: union(current.following, device.following),
        watches: [...new Map([...current.watches, ...device.watches].map((w) => [w.slug, w])).values()],
      });
      // Free coupons only: anyone could claim them, so taking the device's word is safe.
      await app.engagement.claimCoupons(accountId, device.coupons);
      return load(accountId);
    },

    /** After sign-in the device is where edits happen; it saves its copy here. */
    async save(accountId: string, device: DeviceData): Promise<void> {
      await app.cart.replace(accountId, device.cart);
      await app.engagement.replaceLists(accountId, device);
    },
  };
}
