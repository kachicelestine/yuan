import { domainError, err, money, ok, type Clock, type DomainError, type Result } from "@/shared/kernel";
import { checkinReward, checkinState, dayOf, type Checkin, type Watch } from "../domain/coins";
import { claim, isUsable, type Coupon } from "../domain/coupon";
import type { ClaimRepository, CoinRepository, CouponRepository, ListRepository, RewardRepository, WatchRepository } from "../domain/repositories";

export type CouponView = {
  id: string;
  kind: Coupon["kind"];
  /** Dollars for `amount`, a fraction for `percent`. */
  value: number;
  minSpend: number;
  sellerId: string | null;
  title: string;
  detail: string;
  expiresAt: string;
};

export const toCouponView = (c: Coupon): CouponView => ({
  id: c.id,
  kind: c.kind,
  value: c.kind === "amount" ? c.value / 100 : c.value,
  minSpend: c.minSpend / 100,
  sellerId: c.sellerId,
  title: c.title,
  detail: c.detail,
  expiresAt: c.expiresAt.toISOString(),
});

/** A watch as the UI keeps it: target in dollars. */
export type WatchView = { slug: string; target: number; autoBuy: boolean };

/** Everything engagement keeps for one account. */
export type EngagementSnapshot = {
  saved: string[];
  alerts: string[];
  /** Shops the account follows. */
  following: string[];
  watches: WatchView[];
  /** Usable coupon ids in the wallet. */
  coupons: string[];
  coins: number;
  /** Coins earned over time; sets the member level. */
  coinsEarned: number;
  checkin: Checkin;
};

/** Most lists stay small; this caps what one account can store. */
export const MAX_LIST = 500;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const cleanSlugs = (slugs: readonly string[]) => [...new Set(slugs.filter((s) => SLUG.test(s)))].slice(0, MAX_LIST);

/** The coin writes that must land together. */
export type CoinScope = { coins: CoinRepository; claims: ClaimRepository };

export type EngagementDeps = {
  coupons: CouponRepository;
  claims: ClaimRepository;
  lists: ListRepository;
  watches: WatchRepository;
  rewards: RewardRepository;
  coins: CoinRepository;
  uow: { run<T>(work: (scope: CoinScope) => Promise<T>): Promise<T> };
  clock: Clock;
  newId: () => string;
};

export type RedeemError = DomainError<"unknown_reward" | "coupon_expired" | "already_claimed" | "not_enough_coins">;

export function makeEngagement(d: EngagementDeps) {
  async function wallet(accountId: string): Promise<string[]> {
    const now = d.clock.now();
    const [claims, coupons] = await Promise.all([d.claims.listForAccount(accountId), d.coupons.list()]);
    const byId = new Map(coupons.map((c) => [c.id, c]));
    return claims.filter((c) => byId.has(c.couponId) && isUsable(c, byId.get(c.couponId)!, now)).map((c) => c.couponId);
  }

  async function checkin(accountId: string): Promise<Checkin> {
    const today = dayOf(d.clock.now());
    // A streak only ever pays up to day 7, but it can run longer; 400 days covers any streak we show.
    const since = dayOf(new Date(d.clock.now().getTime() - 400 * 86_400_000));
    return checkinState(await d.coins.checkinDays(accountId, since), today);
  }

  return {
    /** People who asked to hear about this product (its price alert, or "tell me when it's back"). */
    async watchersOf(slug: string, limit = 5000): Promise<string[]> {
      return d.lists.holders("alert", slug, limit);
    },

    /** Every coupon that's still running, for the "free to claim" list. */
    async activeCoupons(): Promise<CouponView[]> {
      const now = d.clock.now();
      return (await d.coupons.list()).filter((c) => now < c.expiresAt).map(toCouponView);
    },

    /** Coupon ids in the account's wallet that can still be used. */
    wallet,

    /** Claims free coupons into the wallet. Unknown, expired and already-claimed ones are skipped. */
    async claimCoupons(accountId: string, ids: readonly string[]): Promise<string[]> {
      const now = d.clock.now();
      for (const id of new Set(ids)) {
        if (await d.claims.find(accountId, id)) continue;
        const r = claim(await d.coupons.find(id), accountId, now);
        if (r.ok) await d.claims.add(r.value);
      }
      return wallet(accountId);
    },

    /** A coupon this account holds and can use right now, or null. */
    async usableCoupon(accountId: string, couponId: string): Promise<Coupon | null> {
      const [held, coupon] = await Promise.all([d.claims.find(accountId, couponId), d.coupons.find(couponId)]);
      return held && coupon && isUsable(held, coupon, d.clock.now()) ? coupon : null;
    },

    /**
     * Watches whose price has reached the target and that haven't been told about this
     * price (or lower) yet. Each is marked, so a price that stays low alerts once; a
     * further drop alerts again.
     */
    async dueWatches(prices: (slugs: readonly string[]) => Promise<Map<string, number>>): Promise<{ accountId: string; slug: string; price: number; target: number; addToBag: boolean }[]> {
      const due: { accountId: string; slug: string; price: number; target: number; addToBag: boolean }[] = [];
      for (let offset = 0; ; offset += 500) {
        const page = await d.watches.all(500, offset);
        if (!page.length) break;
        const now = await prices([...new Set(page.map((w) => w.slug))]);
        for (const w of page) {
          const price = now.get(w.slug);
          if (price === undefined || price > w.target || (w.notified !== null && price >= w.notified)) continue;
          await d.watches.markNotified(w.accountId, w.slug, price);
          due.push({ accountId: w.accountId, slug: w.slug, price: price / 100, target: w.target / 100, addToBag: w.autoBuy });
        }
        if (page.length < 500) break;
      }
      return due;
    },

    /** How many accounts follow each shop. */
    followerCounts() {
      return d.lists.counts("follow");
    },

    /** How many people saved each product in a window (for rankings). */
    savesBetween(from: Date, to: Date) {
      return d.lists.addedBetween("saved", from, to);
    },

    async snapshot(accountId: string): Promise<EngagementSnapshot> {
      const [saved, alerts, following, watches, coupons, coins, coinsEarned, streak] = await Promise.all([
        d.lists.get(accountId, "saved"),
        d.lists.get(accountId, "alert"),
        d.lists.get(accountId, "follow"),
        d.watches.list(accountId),
        wallet(accountId),
        d.coins.balance(accountId),
        d.coins.earned(accountId),
        checkin(accountId),
      ]);
      return { saved, alerts, following, watches: watches.map((w) => ({ slug: w.slug, target: w.target / 100, autoBuy: w.autoBuy })), coupons, coins, coinsEarned, checkin: streak };
    },

    /** Saves the lists as the device has them now. */
    async replaceLists(accountId: string, lists: { saved: readonly string[]; alerts: readonly string[]; watches: readonly WatchView[]; following?: readonly string[] }) {
      const bySlug = new Map<string, Watch>();
      for (const w of lists.watches) {
        if (!SLUG.test(w.slug) || !Number.isFinite(w.target) || w.target <= 0) continue;
        bySlug.set(w.slug, { slug: w.slug, target: money.fromDollars(w.target), autoBuy: w.autoBuy === true });
      }
      await d.lists.replace(accountId, "saved", cleanSlugs(lists.saved), d.clock.now());
      await d.lists.replace(accountId, "alert", cleanSlugs(lists.alerts), d.clock.now());
      if (lists.following) await d.lists.replace(accountId, "follow", cleanSlugs(lists.following), d.clock.now());
      await d.watches.replace(accountId, [...bySlug.values()].slice(0, MAX_LIST));
    },

    /** Today's check-in. Checking in twice in a day pays once. */
    async checkIn(accountId: string): Promise<{ coins: number; checkin: Checkin; earned: number }> {
      const now = d.clock.now();
      const before = await checkin(accountId);
      let earned = 0;
      if (!before.claimedToday) {
        const amount = checkinReward(before.streak);
        const credited = await d.uow.run(({ coins }) => coins.credit({ id: d.newId(), accountId, amount, reason: "checkin", ref: dayOf(now), at: now }));
        if (credited) earned = amount;
      }
      const [coins, state] = await Promise.all([d.coins.balance(accountId), checkin(accountId)]);
      return { coins, checkin: state, earned };
    },

    /** Spends coins on a reward: the coins go and the coupon lands in the wallet together, or neither. */
    async redeem(accountId: string, rewardId: string): Promise<Result<{ coins: number; coupons: string[] }, RedeemError>> {
      const now = d.clock.now();
      const reward = await d.rewards.find(rewardId);
      if (!reward) return err(domainError("unknown_reward", "That reward isn't available."));
      const claimed = claim(await d.coupons.find(reward.couponId), accountId, now);
      if (!claimed.ok) return err(domainError("coupon_expired", "That coupon has ended."));

      const outcome = await d.uow.run(async ({ coins, claims }) => {
        if (await claims.find(accountId, reward.couponId)) return "already_claimed" as const;
        const paid = await coins.debit({ id: d.newId(), accountId, amount: -reward.cost, reason: "reward", ref: reward.id, at: now });
        if (!paid) return "not_enough_coins" as const;
        await claims.add(claimed.value);
        return "ok" as const;
      });
      if (outcome === "already_claimed") return err(domainError(outcome, "That coupon is already in your wallet."));
      if (outcome === "not_enough_coins") return err(domainError(outcome, "You don't have enough coins for that yet."));
      return ok({ coins: await d.coins.balance(accountId), coupons: await wallet(accountId) });
    },
  };
}

export type Engagement = ReturnType<typeof makeEngagement>;
