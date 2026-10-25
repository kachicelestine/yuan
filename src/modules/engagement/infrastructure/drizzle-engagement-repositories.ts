import { and, asc, desc, eq, gte, isNull, lt, sql } from "drizzle-orm";
import type { Database } from "@/shared/infrastructure/database";
import { cents } from "@/shared/kernel/money";
import type { CoinEntry, CoinReason, Reward, Watch } from "../domain/coins";
import type { Claim, Coupon } from "../domain/coupon";
import type { ClaimRepository, CoinRepository, CouponRepository, ListKind, ListRepository, RewardRepository, WatchRepository } from "../domain/repositories";
import { coinBalances, coinEntries, couponClaims, coupons, listItems, rewards, watches } from "./schema";

const toCoupon = (r: typeof coupons.$inferSelect): Coupon => ({
  id: r.id,
  kind: r.kind,
  value: r.value,
  minSpend: cents(r.minSpendCents),
  sellerId: r.sellerId,
  title: r.title,
  detail: r.detail,
  expiresAt: r.expiresAt,
});

export class DrizzleCouponRepository implements CouponRepository {
  constructor(private readonly db: Database) {}

  async list() {
    return (await this.db.select().from(coupons).orderBy(asc(coupons.expiresAt))).map(toCoupon);
  }

  async find(id: string) {
    const [r] = await this.db.select().from(coupons).where(eq(coupons.id, id)).limit(1);
    return r ? toCoupon(r) : null;
  }
}

export class DrizzleClaimRepository implements ClaimRepository {
  constructor(private readonly db: Database) {}

  async listForAccount(accountId: string): Promise<Claim[]> {
    return this.db.select().from(couponClaims).where(eq(couponClaims.accountId, accountId)).orderBy(asc(couponClaims.claimedAt));
  }

  async find(accountId: string, couponId: string) {
    const [r] = await this.db
      .select()
      .from(couponClaims)
      .where(and(eq(couponClaims.accountId, accountId), eq(couponClaims.couponId, couponId)))
      .limit(1);
    return r ?? null;
  }

  async add(c: Claim) {
    await this.db.insert(couponClaims).values(c).onConflictDoNothing();
  }

  /** One conditional UPDATE: only a free, unspent claim can be taken, and only by one order. */
  async reserve(accountId: string, couponId: string, orderId: string) {
    const rows = await this.db
      .update(couponClaims)
      .set({ orderId })
      .where(and(eq(couponClaims.accountId, accountId), eq(couponClaims.couponId, couponId), isNull(couponClaims.orderId), isNull(couponClaims.redeemedAt)))
      .returning({ couponId: couponClaims.couponId });
    return rows.length === 1;
  }

  async redeemForOrder(orderId: string, at: Date) {
    await this.db
      .update(couponClaims)
      .set({ redeemedAt: at })
      .where(and(eq(couponClaims.orderId, orderId), isNull(couponClaims.redeemedAt)));
  }

  async releaseForOrder(orderId: string) {
    await this.db
      .update(couponClaims)
      .set({ orderId: null })
      .where(and(eq(couponClaims.orderId, orderId), isNull(couponClaims.redeemedAt)));
  }
}

export class DrizzleListRepository implements ListRepository {
  constructor(private readonly db: Database) {}

  async get(accountId: string, kind: ListKind) {
    const rows = await this.db
      .select({ slug: listItems.slug })
      .from(listItems)
      .where(and(eq(listItems.accountId, accountId), eq(listItems.kind, kind)))
      .orderBy(asc(listItems.position));
    return rows.map((r) => r.slug);
  }

  async replace(accountId: string, kind: ListKind, slugs: readonly string[], at: Date) {
    await this.db.transaction(async (tx) => {
      const where = and(eq(listItems.accountId, accountId), eq(listItems.kind, kind));
      // Items already on the list keep the day they were added; only new ones are "now".
      const added = new Map((await tx.select({ slug: listItems.slug, addedAt: listItems.addedAt }).from(listItems).where(where)).map((r) => [r.slug, r.addedAt]));
      await tx.delete(listItems).where(where);
      if (slugs.length) await tx.insert(listItems).values(slugs.map((slug, position) => ({ accountId, kind, slug, position, addedAt: added.get(slug) ?? at })));
    });
  }

  async addedBetween(kind: ListKind, from: Date, to: Date) {
    const rows = await this.db
      .select({ slug: listItems.slug, n: sql<number>`count(*)::int` })
      .from(listItems)
      .where(and(eq(listItems.kind, kind), gte(listItems.addedAt, from), lt(listItems.addedAt, to)))
      .groupBy(listItems.slug);
    return new Map(rows.map((r) => [r.slug, r.n]));
  }
}

export class DrizzleWatchRepository implements WatchRepository {
  constructor(private readonly db: Database) {}

  async list(accountId: string): Promise<Watch[]> {
    const rows = await this.db.select().from(watches).where(eq(watches.accountId, accountId)).orderBy(asc(watches.slug));
    return rows.map((r) => ({ slug: r.slug, target: cents(r.targetCents), autoBuy: r.autoBuy }));
  }

  async replace(accountId: string, list: readonly Watch[]) {
    await this.db.transaction(async (tx) => {
      await tx.delete(watches).where(eq(watches.accountId, accountId));
      if (list.length) await tx.insert(watches).values(list.map((w) => ({ accountId, slug: w.slug, targetCents: w.target, autoBuy: w.autoBuy })));
    });
  }
}

export class DrizzleRewardRepository implements RewardRepository {
  constructor(private readonly db: Database) {}

  async list(): Promise<Reward[]> {
    return this.db.select().from(rewards).orderBy(asc(rewards.cost));
  }

  async find(id: string) {
    const [r] = await this.db.select().from(rewards).where(eq(rewards.id, id)).limit(1);
    return r ?? null;
  }
}

export class DrizzleCoinRepository implements CoinRepository {
  constructor(private readonly db: Database) {}

  async earned(accountId: string) {
    const [r] = await this.db
      .select({ n: sql<number>`coalesce(sum(${coinEntries.amount}) filter (where ${coinEntries.amount} > 0), 0)::int` })
      .from(coinEntries)
      .where(eq(coinEntries.accountId, accountId));
    return r?.n ?? 0;
  }

  async refs(accountId: string, reason: CoinReason) {
    return (await this.db.select({ ref: coinEntries.ref }).from(coinEntries).where(and(eq(coinEntries.accountId, accountId), eq(coinEntries.reason, reason)))).map((r) => r.ref);
  }

  async balance(accountId: string) {
    const [r] = await this.db.select({ balance: coinBalances.balance }).from(coinBalances).where(eq(coinBalances.accountId, accountId)).limit(1);
    return r?.balance ?? 0;
  }

  async checkinDays(accountId: string, since: string) {
    const rows = await this.db
      .select({ ref: coinEntries.ref })
      .from(coinEntries)
      .where(and(eq(coinEntries.accountId, accountId), eq(coinEntries.reason, "checkin"), gte(coinEntries.ref, since)))
      .orderBy(desc(coinEntries.ref));
    return rows.map((r) => r.ref);
  }

  /** The entry goes in first; only a new entry moves the balance. */
  async credit(entry: CoinEntry) {
    const inserted = await this.db.insert(coinEntries).values(entry).onConflictDoNothing().returning({ id: coinEntries.id });
    if (!inserted.length) return false;
    await this.db
      .insert(coinBalances)
      .values({ accountId: entry.accountId, balance: entry.amount })
      .onConflictDoUpdate({ target: coinBalances.accountId, set: { balance: sql`${coinBalances.balance} + ${entry.amount}` } });
    return true;
  }

  /** `entry.amount` is negative. The balance moves by a conditional UPDATE, so two spends can't overdraw. */
  async debit(entry: CoinEntry) {
    const inserted = await this.db.insert(coinEntries).values(entry).onConflictDoNothing().returning({ id: coinEntries.id });
    if (!inserted.length) return false;
    const updated = await this.db
      .update(coinBalances)
      .set({ balance: sql`${coinBalances.balance} + ${entry.amount}` })
      .where(and(eq(coinBalances.accountId, entry.accountId), gte(coinBalances.balance, -entry.amount)))
      .returning({ balance: coinBalances.balance });
    if (updated.length) return true;
    await this.db.delete(coinEntries).where(eq(coinEntries.id, entry.id));
    return false;
  }
}
