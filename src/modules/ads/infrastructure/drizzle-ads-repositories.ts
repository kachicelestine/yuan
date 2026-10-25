import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import type { Database } from "@/shared/infrastructure/database";
import { cents } from "@/shared/kernel/money";
import type { Campaign } from "../domain/ads";
import type { AdStatsRepository, CampaignRepository, DailyStats } from "../domain/repositories";
import { campaigns, daily } from "./schema";

const toCampaign = (r: typeof campaigns.$inferSelect): Campaign => ({
  id: r.id,
  sellerId: r.sellerId,
  name: r.name,
  slugs: r.slugs,
  bid: cents(r.bidCents),
  dailyBudget: cents(r.dailyBudgetCents),
  status: r.status,
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
});

export class DrizzleCampaignRepository implements CampaignRepository {
  constructor(private readonly db: Database) {}

  async find(id: string) {
    const [r] = await this.db.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
    return r ? toCampaign(r) : null;
  }

  async save(c: Campaign) {
    const values = {
      id: c.id,
      sellerId: c.sellerId,
      name: c.name,
      slugs: [...c.slugs],
      bidCents: c.bid,
      dailyBudgetCents: c.dailyBudget,
      status: c.status,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    };
    await this.db.insert(campaigns).values(values).onConflictDoUpdate({ target: campaigns.id, set: values });
  }

  async forSeller(sellerId: string) {
    return (await this.db.select().from(campaigns).where(eq(campaigns.sellerId, sellerId)).orderBy(desc(campaigns.createdAt))).map(toCampaign);
  }

  async active() {
    return (await this.db.select().from(campaigns).where(eq(campaigns.status, "active")).orderBy(asc(campaigns.createdAt))).map(toCampaign);
  }
}

export class DrizzleAdStatsRepository implements AdStatsRepository {
  constructor(private readonly db: Database) {}

  async addImpressions(campaignIds: readonly string[], day: string) {
    const ids = [...new Set(campaignIds)];
    if (!ids.length) return;
    await this.db
      .insert(daily)
      .values(ids.map((campaignId) => ({ campaignId, day, impressions: 1 })))
      .onConflictDoUpdate({ target: [daily.campaignId, daily.day], set: { impressions: sql`${daily.impressions} + 1` } });
  }

  async addClick(campaignId: string, day: string, spend: number) {
    await this.db
      .insert(daily)
      .values({ campaignId, day, clicks: 1, spendCents: spend })
      .onConflictDoUpdate({ target: [daily.campaignId, daily.day], set: { clicks: sql`${daily.clicks} + 1`, spendCents: sql`${daily.spendCents} + ${spend}` } });
  }

  async day(campaignIds: readonly string[], day: string) {
    if (!campaignIds.length) return new Map<string, DailyStats>();
    const rows = await this.db
      .select()
      .from(daily)
      .where(and(inArray(daily.campaignId, [...campaignIds]), eq(daily.day, day)));
    return new Map(rows.map((r) => [r.campaignId, { impressions: r.impressions, clicks: r.clicks, spend: r.spendCents }]));
  }

  async lifetime(campaignIds: readonly string[]) {
    if (!campaignIds.length) return new Map<string, DailyStats>();
    const rows = await this.db
      .select({
        campaignId: daily.campaignId,
        impressions: sql<number>`sum(${daily.impressions})::int`,
        clicks: sql<number>`sum(${daily.clicks})::int`,
        spend: sql<number>`sum(${daily.spendCents})::bigint`,
      })
      .from(daily)
      .where(inArray(daily.campaignId, [...campaignIds]))
      .groupBy(daily.campaignId);
    return new Map(rows.map((r) => [r.campaignId, { impressions: r.impressions, clicks: r.clicks, spend: Number(r.spend) }]));
  }
}
