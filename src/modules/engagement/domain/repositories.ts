import type { CoinEntry, Reward, Watch } from "./coins";
import type { Claim, Coupon } from "./coupon";

export interface CouponRepository {
  list(): Promise<Coupon[]>;
  find(id: string): Promise<Coupon | null>;
}

export interface ClaimRepository {
  listForAccount(accountId: string): Promise<Claim[]>;
  find(accountId: string, couponId: string): Promise<Claim | null>;
  /** Adds a claim; claiming the same coupon twice keeps the first claim. */
  add(claim: Claim): Promise<void>;
  /**
   * Reserves a usable claim for an order in one atomic step, so two checkouts racing
   * for the same coupon can't both get it. True when this order got it.
   */
  reserve(accountId: string, couponId: string, orderId: string): Promise<boolean>;
  /** Spends the coupon reserved for a paid order. */
  redeemForOrder(orderId: string, at: Date): Promise<void>;
  /** Frees the coupon reserved for an order that lapsed unpaid. */
  releaseForOrder(orderId: string): Promise<void>;
}

export type ListKind = "saved" | "alert";

/** Per-account sets of product slugs: saved items and price alerts. */
export interface ListRepository {
  get(accountId: string, kind: ListKind): Promise<string[]>;
  replace(accountId: string, kind: ListKind, slugs: readonly string[]): Promise<void>;
}

export interface WatchRepository {
  list(accountId: string): Promise<Watch[]>;
  replace(accountId: string, watches: readonly Watch[]): Promise<void>;
}

export interface RewardRepository {
  list(): Promise<Reward[]>;
  find(id: string): Promise<Reward | null>;
}

/** Coin balances and their history. Writes must run inside a unit of work. */
export interface CoinRepository {
  balance(accountId: string): Promise<number>;
  /** UTC days (YYYY-MM-DD) with a check-in, newest first, from `since` on. */
  checkinDays(accountId: string, since: string): Promise<string[]>;
  /** Adds coins once per (reason, ref). False when that entry already exists. */
  credit(entry: CoinEntry): Promise<boolean>;
  /** Takes coins once per (reason, ref), only if the balance covers it. False otherwise. */
  debit(entry: CoinEntry): Promise<boolean>;
}
