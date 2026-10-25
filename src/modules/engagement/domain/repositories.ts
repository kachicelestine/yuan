import type { CoinEntry, CoinReason, Reward, Watch } from "./coins";
import type { Claim, Coupon } from "./coupon";
import type { Poll, PollVote } from "./poll";
import type { Chop, ChopCut, ChopOffer, ChopStatus } from "./chop";

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
  /** Rewrites the list; items already on it keep when they were added, new ones get `at`. */
  replace(accountId: string, kind: ListKind, slugs: readonly string[], at: Date): Promise<void>;
  /** How many people added each product to this kind of list between `from` and `to`. */
  addedBetween(kind: ListKind, from: Date, to: Date): Promise<Map<string, number>>;
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
  /** All coins ever earned (spending doesn't count against it). */
  earned(accountId: string): Promise<number>;
  /** The refs of this account's entries for one reason (e.g. missions claimed). */
  refs(accountId: string, reason: CoinReason): Promise<string[]>;
}

export interface PollRepository {
  find(id: string): Promise<Poll | null>;
  /** False when the id is taken. */
  create(poll: Poll): Promise<boolean>;
  votes(pollId: string): Promise<PollVote[]>;
  /** Adds a vote or replaces the voter's earlier one (keeping their reason unless a new one is given). */
  vote(vote: PollVote): Promise<void>;
  byAuthor(authorId: string, limit: number): Promise<Poll[]>;
}

export interface ChopRepository {
  offer(id: string): Promise<ChopOffer | null>;
  /** Offers that can be started now (active, with stock), or a shop's own. */
  offers(filter: { sellerId?: string; startable?: boolean; limit: number }): Promise<ChopOffer[]>;
  saveOffer(offer: ChopOffer): Promise<void>;
  /** Takes one unit of the offer's stock; false when none is left. */
  reserve(offerId: string): Promise<boolean>;
  /** Gives a unit back (a chop ran out of time). */
  release(offerId: string): Promise<void>;
  find(id: string): Promise<Chop | null>;
  /** Locks the chop for the rest of the transaction, so two last cuts can't both count. */
  lock(id: string): Promise<Chop | null>;
  /** False when the id is taken. */
  create(chop: Chop): Promise<boolean>;
  /** Moves a chop between states only if it is still in `from`. */
  transition(id: string, from: ChopStatus, to: ChopStatus, doneAt?: Date): Promise<boolean>;
  openFor(ownerId: string, offerId: string): Promise<Chop | null>;
  forOwner(ownerId: string, limit: number): Promise<Chop[]>;
  cuts(chopId: string): Promise<ChopCut[]>;
  /** False when this person already cut this chop. */
  addCut(cut: ChopCut): Promise<boolean>;
  cutsSince(cutter: string, since: Date): Promise<number>;
  /** Open chops whose clock ran out. */
  lapsed(at: Date, limit: number): Promise<Chop[]>;
  /** The owner's finished chops for a product, newest first. */
  done(ownerId: string, slug: string): Promise<Chop[]>;
  /** Chops started and finished per offer. */
  stats(offerIds: readonly string[]): Promise<Map<string, { started: number; done: number }>>;
}
