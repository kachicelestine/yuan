import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import type { Database } from "@/shared/infrastructure/database";
import { cents } from "@/shared/kernel/money";
import type { Commission, Creator, Program } from "../domain/affiliate";
import type { ClickRepository, CommissionRepository, CreatorRepository, ProgramRepository } from "../domain/repositories";
import { clicks, commissions, creators, programs } from "./schema";

const toCreator = (r: typeof creators.$inferSelect): Creator => ({ accountId: r.accountId, code: r.code, wallet: r.wallet, createdAt: r.createdAt });

export class DrizzleCreatorRepository implements CreatorRepository {
  constructor(private readonly db: Database) {}

  async byAccount(accountId: string) {
    const [r] = await this.db.select().from(creators).where(eq(creators.accountId, accountId)).limit(1);
    return r ? toCreator(r) : null;
  }

  async byCode(code: string) {
    const [r] = await this.db.select().from(creators).where(eq(creators.code, code)).limit(1);
    return r ? toCreator(r) : null;
  }

  async byAccounts(accountIds: readonly string[]) {
    if (!accountIds.length) return [];
    return (await this.db.select().from(creators).where(inArray(creators.accountId, [...accountIds]))).map(toCreator);
  }

  async create(c: Creator) {
    const rows = await this.db.insert(creators).values(c).onConflictDoNothing().returning({ accountId: creators.accountId });
    return rows.length > 0;
  }

  async save(c: Creator) {
    await this.db.update(creators).set({ wallet: c.wallet }).where(eq(creators.accountId, c.accountId));
  }
}

export class DrizzleProgramRepository implements ProgramRepository {
  constructor(private readonly db: Database) {}

  async rates(sellerIds: readonly string[]) {
    if (!sellerIds.length) return new Map<string, number>();
    const rows = await this.db.select().from(programs).where(inArray(programs.sellerId, [...sellerIds]));
    return new Map(rows.map((r) => [r.sellerId, r.rate]));
  }

  async save(p: Program) {
    await this.db.insert(programs).values(p).onConflictDoUpdate({ target: programs.sellerId, set: { rate: p.rate, updatedAt: p.updatedAt } });
  }
}

export class DrizzleClickRepository implements ClickRepository {
  constructor(private readonly db: Database) {}

  async add(code: string, slug: string, day: string) {
    await this.db
      .insert(clicks)
      .values({ code, slug, day, clicks: 1 })
      .onConflictDoUpdate({ target: [clicks.code, clicks.day, clicks.slug], set: { clicks: sql`${clicks.clicks} + 1` } });
  }

  async bySlug(code: string, sinceDay: string) {
    return this.db
      .select({ slug: clicks.slug, clicks: sql<number>`sum(${clicks.clicks})::int` })
      .from(clicks)
      .where(and(eq(clicks.code, code), gte(clicks.day, sinceDay)))
      .groupBy(clicks.slug)
      .orderBy(desc(sql`sum(${clicks.clicks})`))
      .limit(50);
  }

  async total(code: string, sinceDay: string) {
    const [r] = await this.db
      .select({ n: sql<number>`coalesce(sum(${clicks.clicks}), 0)::int` })
      .from(clicks)
      .where(and(eq(clicks.code, code), gte(clicks.day, sinceDay)));
    return r?.n ?? 0;
  }
}

const toCommission = (r: typeof commissions.$inferSelect): Commission => ({
  id: r.id,
  orderId: r.orderId,
  sellerId: r.sellerId,
  creatorId: r.creatorId,
  code: r.code,
  base: cents(r.baseCents),
  rate: r.rate,
  amount: cents(r.amountCents),
  slugs: r.slugs,
  status: r.status,
  createdAt: r.createdAt,
  settledAt: r.settledAt,
});

export class DrizzleCommissionRepository implements CommissionRepository {
  constructor(private readonly db: Database) {}

  async find(orderId: string, sellerId: string) {
    const [r] = await this.db
      .select()
      .from(commissions)
      .where(and(eq(commissions.orderId, orderId), eq(commissions.sellerId, sellerId)))
      .limit(1);
    return r ? toCommission(r) : null;
  }

  async forOrder(orderId: string) {
    return (await this.db.select().from(commissions).where(eq(commissions.orderId, orderId))).map(toCommission);
  }

  async add(c: Commission) {
    const rows = await this.db
      .insert(commissions)
      .values({
        id: c.id,
        orderId: c.orderId,
        sellerId: c.sellerId,
        creatorId: c.creatorId,
        code: c.code,
        baseCents: c.base,
        rate: c.rate,
        amountCents: c.amount,
        slugs: [...c.slugs],
        status: c.status,
        createdAt: c.createdAt,
        settledAt: c.settledAt,
      })
      .onConflictDoNothing()
      .returning({ id: commissions.id });
    return rows.length > 0;
  }

  async save(c: Commission) {
    await this.db.update(commissions).set({ status: c.status, settledAt: c.settledAt }).where(eq(commissions.id, c.id));
  }

  async forCreator(creatorId: string, limit: number) {
    return (await this.db.select().from(commissions).where(eq(commissions.creatorId, creatorId)).orderBy(desc(commissions.createdAt)).limit(limit)).map(toCommission);
  }

  async forSeller(sellerId: string, limit: number) {
    return (await this.db.select().from(commissions).where(eq(commissions.sellerId, sellerId)).orderBy(desc(commissions.createdAt)).limit(limit)).map(toCommission);
  }
}

export const affiliatesRepos = (db: Database) => ({
  creators: new DrizzleCreatorRepository(db),
  programs: new DrizzleProgramRepository(db),
  clicks: new DrizzleClickRepository(db),
  commissions: new DrizzleCommissionRepository(db),
});
