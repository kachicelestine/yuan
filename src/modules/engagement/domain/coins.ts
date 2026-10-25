import type { Cents } from "@/shared/kernel";

/** Coins for days 1–7 of a check-in streak; day 7 and beyond pay the last amount. */
export const CHECKIN_REWARDS = [10, 10, 20, 20, 30, 30, 100] as const;

export type CoinReason = "checkin" | "reward" | "mission" | "adjustment";

/**
 * One movement of coins. `ref` makes it happen once: a check-in's ref is its day,
 * a reward's ref is the reward bought.
 */
export type CoinEntry = Readonly<{ id: string; accountId: string; amount: number; reason: CoinReason; ref: string; at: Date }>;

/** Something coins can buy: a coupon put straight into the wallet. */
export type Reward = Readonly<{ id: string; title: string; cost: number; couponId: string }>;

/** Days are counted in UTC so a streak means the same thing on every server. */
export const dayOf = (at: Date) => at.toISOString().slice(0, 10);

const previousDay = (day: string) => dayOf(new Date(Date.parse(`${day}T00:00:00Z`) - 86_400_000));

export type Checkin = { streak: number; claimedToday: boolean };

/**
 * The streak as of `today`: consecutive check-in days ending today (if already checked
 * in) or yesterday. A missed day starts it again.
 */
export function checkinState(days: readonly string[], today: string): Checkin {
  const set = new Set(days);
  const claimedToday = set.has(today);
  let streak = 0;
  for (let d = claimedToday ? today : previousDay(today); set.has(d); d = previousDay(d)) streak++;
  return { streak, claimedToday };
}

/** Coins the next check-in pays, given the streak before it. */
export const checkinReward = (streakBefore: number) => CHECKIN_REWARDS[Math.min(streakBefore, CHECKIN_REWARDS.length - 1)];

/** A target price for a product, and whether to buy it automatically when the price gets there. */
export type Watch = Readonly<{ slug: string; target: Cents; autoBuy: boolean }>;
