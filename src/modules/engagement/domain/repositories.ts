import type { CoinEntry, CoinReason, Reward, Watch } from "./coins";
import type { Claim, Coupon } from "./coupon";
import type { Poll, PollVote } from "./poll";
import type { Chop, ChopCut, ChopOffer, ChopStatus } from "./chop";
import type { Drop, Team, TeamMember, TeamOffer, TeamStatus } from "./drop";
import type { Board } from "./board";
import type { Box, Case, Series } from "./blindbox";
import type { Deposit, DepositOffer, DepositStatus } from "./deposit";

export interface CouponRepository {
  list(): Promise<Coupon[]>;
  find(id: string): Promise<Coupon | null>;
  findMany(ids: readonly string[]): Promise<Coupon[]>;
  listForSeller(sellerId: string): Promise<Coupon[]>;
  save(coupon: Coupon): Promise<void>;
}

/** How far a coupon has gone: into wallets, and spent on paid orders. */
export type CouponStats = { claimed: number; used: number };

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
  stats(couponIds: readonly string[]): Promise<Map<string, CouponStats>>;
}

/** saved and alert hold product slugs; follow holds shop ids. */
export type ListKind = "saved" | "alert" | "follow";

/** Per-account sets of product slugs: saved items and price alerts. */
export interface ListRepository {
  get(accountId: string, kind: ListKind): Promise<string[]>;
  /** Rewrites the list; items already on it keep when they were added, new ones get `at`. */
  replace(accountId: string, kind: ListKind, slugs: readonly string[], at: Date): Promise<void>;
  /** How many people added each product to this kind of list between `from` and `to`. */
  addedBetween(kind: ListKind, from: Date, to: Date): Promise<Map<string, number>>;
  /** How many accounts have each item on this kind of list. */
  counts(kind: ListKind): Promise<Map<string, number>>;
  /** Accounts with this item on this kind of list. */
  holders(kind: ListKind, slug: string, limit: number): Promise<string[]>;
}

export interface WatchRepository {
  list(accountId: string): Promise<Watch[]>;
  /** Rewrites someone's watches; one kept at the same target keeps its last alert. */
  replace(accountId: string, watches: readonly Watch[]): Promise<void>;
  /** Every watch with the price last alerted, a page at a time. */
  all(limit: number, offset: number): Promise<(Watch & { accountId: string; notified: number | null })[]>;
  markNotified(accountId: string, slug: string, price: number): Promise<void>;
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

export interface DropRepository {
  find(id: string): Promise<Drop | null>;
  /** Inserts a drop, or saves a cancellation (stock moves only through take/give). */
  save(drop: Drop): Promise<void>;
  /** Drops not yet over (ending after `from`), soonest first; or a shop's own. */
  list(filter: { from?: Date; sellerId?: string; limit: number }): Promise<Drop[]>;
  /** Takes `qty` from the drop-price stock; false when there isn't that much left. */
  take(id: string, qty: number): Promise<boolean>;
  give(id: string, qty: number): Promise<void>;
}

/** A better price someone may check out at for a while: a drop claim or a full team. */
export type PromoHold = Readonly<{
  id: string;
  accountId: string;
  slug: string;
  price: number;
  qty: number;
  source: "drop" | "team";
  sourceId: string;
  expiresAt: Date;
  usedAt: Date | null;
}>;

export interface PromoHoldRepository {
  add(hold: PromoHold): Promise<void>;
  /** Units someone holds or bought through one drop or team. */
  taken(accountId: string, source: PromoHold["source"], sourceId: string): Promise<number>;
  /** The lowest live price this person holds for a product. */
  best(accountId: string, slug: string, at: Date): Promise<PromoHold | null>;
  use(accountId: string, slugs: readonly string[], at: Date): Promise<void>;
  /** Unused holds that ran out, not yet given back to their drop. */
  lapsed(at: Date, limit: number): Promise<PromoHold[]>;
  /** Marks a lapsed hold as handled; false if another worker already did. */
  retire(id: string): Promise<boolean>;
}

export interface TeamRepository {
  offer(id: string): Promise<TeamOffer | null>;
  offers(filter: { sellerId?: string; startable?: boolean; limit: number }): Promise<TeamOffer[]>;
  saveOffer(offer: TeamOffer): Promise<void>;
  reserve(offerId: string): Promise<boolean>;
  release(offerId: string): Promise<void>;
  find(id: string): Promise<Team | null>;
  lock(id: string): Promise<Team | null>;
  create(team: Team): Promise<boolean>;
  transition(id: string, from: TeamStatus, to: TeamStatus, fullAt?: Date): Promise<boolean>;
  members(teamId: string): Promise<TeamMember[]>;
  addMember(member: TeamMember): Promise<boolean>;
  /** Open teams for these offers, ending soonest first. */
  open(offerIds: readonly string[], at: Date, limit: number): Promise<Team[]>;
  /** The open team this person leads or joined for an offer, if any. */
  openFor(accountId: string, offerId: string, at: Date): Promise<Team | null>;
  lapsed(at: Date, limit: number): Promise<Team[]>;
  stats(offerIds: readonly string[]): Promise<Map<string, { started: number; full: number }>>;
}

export type Reminder = Readonly<{ key: string; accountId: string; at: Date; title: string; link: string }>;

export interface ReminderRepository {
  set(reminder: Reminder): Promise<void>;
  unset(key: string, accountId: string): Promise<void>;
  /** Which of these keys this person has a reminder for. */
  mine(accountId: string, keys: readonly string[]): Promise<Set<string>>;
  /** How many people are waiting on each key. */
  counts(keys: readonly string[]): Promise<Map<string, number>>;
  /** Unsent reminders for things starting before `until`. */
  due(until: Date, limit: number): Promise<Reminder[]>;
  /** False when it was already sent. */
  markSent(key: string, accountId: string, at: Date): Promise<boolean>;
  removeKey(key: string): Promise<void>;
}

export interface BoardRepository {
  find(id: string): Promise<Board | null>;
  save(board: Board): Promise<void>;
  remove(id: string): Promise<void>;
  /** Newest first. */
  forOwner(accountId: string): Promise<Board[]>;
  /** Public boards with three or more items, most followed first. */
  popular(limit: number): Promise<Board[]>;
  followedBy(accountId: string): Promise<Board[]>;
  followers(boardIds: readonly string[]): Promise<Map<string, number>>;
  following(accountId: string, boardIds: readonly string[]): Promise<Set<string>>;
  follow(boardId: string, accountId: string, at: Date): Promise<void>;
  unfollow(boardId: string, accountId: string): Promise<void>;
}

export interface BlindBoxRepository {
  series(id: string): Promise<Series | null>;
  /** The active series sold as this listing, if any. */
  seriesFor(slug: string): Promise<Series | null>;
  activeSeries(): Promise<Series[]>;
  sellerSeries(sellerId: string): Promise<Series[]>;
  /** Cases opened and boxes sold so far. */
  seriesStats(seriesId: string): Promise<{ cases: number; sold: number }>;
  saveSeries(series: Series): Promise<void>;
  /** The newest case of a series, with its boxes' states. */
  latestCase(seriesId: string): Promise<Case | null>;
  findCase(id: string): Promise<Case | null>;
  /** False when another case took that number first. */
  createCase(c: Case): Promise<boolean>;
  boxes(caseIds: readonly string[]): Promise<Box[]>;
  /** Takes a box for this buyer if it's free (or already theirs); false if someone else has it. */
  hold(box: Box, now: Date): Promise<boolean>;
  release(caseId: string, index: number, buyerId: string): Promise<void>;
  /** Live holds of one buyer. */
  heldBy(buyerId: string, now: Date): Promise<Box[]>;
  /** Marks one of the buyer's boxes sold to an order; false if it wasn't theirs to sell. */
  sell(caseId: string, index: number, buyerId: string, orderId: string, now: Date): Promise<boolean>;
  /** Boxes already sold to an order (to make payment handling idempotent). */
  soldTo(orderId: string): Promise<Box[]>;
  forOrders(orderIds: readonly string[]): Promise<Box[]>;
  owned(buyerId: string, seriesId: string): Promise<Box[]>;
  markOpened(caseId: string, index: number, buyerId: string, at: Date): Promise<boolean>;
  hints(caseId: string, buyerId: string): Promise<{ index: number; figureId: string }[]>;
  addHint(caseId: string, index: number, buyerId: string, figureId: string, at: Date): Promise<void>;
  /** Drops holds that ran out. */
  sweep(now: Date): Promise<number>;
}

export interface DepositRepository {
  offer(id: string): Promise<DepositOffer | null>;
  saveOffer(offer: DepositOffer): Promise<void>;
  sellerOffers(sellerId: string): Promise<DepositOffer[]>;
  /** Offers taking deposits, about to, or with a balance window still to come. */
  currentOffers(now: Date): Promise<DepositOffer[]>;
  find(id: string): Promise<Deposit | null>;
  byOrder(orderId: string): Promise<Deposit | null>;
  /** Takes one from the offer's stock and records the deposit, or false if none are left. */
  reserve(deposit: Deposit): Promise<boolean>;
  save(deposit: Deposit): Promise<void>;
  /** Gives a pending deposit's place back to the offer. */
  release(deposit: Deposit): Promise<void>;
  /** A buyer's deposits (any status), with their offers. */
  forBuyer(buyerId: string): Promise<{ deposit: Deposit; offer: DepositOffer }[]>;
  forOffer(offerId: string, statuses: readonly DepositStatus[]): Promise<Deposit[]>;
  /** Deposits converted into this order. */
  forFinalOrder(orderId: string): Promise<{ deposit: Deposit; offer: DepositOffer }[]>;
  /** Paid deposits whose balance window has closed. */
  lapsed(now: Date): Promise<{ deposit: Deposit; offer: DepositOffer }[]>;
  /** Paid deposits whose balance window just opened and haven't been told. */
  toRemind(now: Date): Promise<{ deposit: Deposit; offer: DepositOffer }[]>;
}
