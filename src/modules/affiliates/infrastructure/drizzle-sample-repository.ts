import { and, asc, desc, eq, gt, lt, sql } from "drizzle-orm";
import type { Database } from "@/shared/infrastructure/database";
import type { SampleOffer, SampleRequest } from "../domain/sample";
import type { SampleRepository } from "../domain/repositories";
import { sampleOffers, sampleRequests } from "./schema";

export class DrizzleSampleRepository implements SampleRepository {
  constructor(private readonly db: Database) {}

  async offer(id: string) {
    const [r] = await this.db.select().from(sampleOffers).where(eq(sampleOffers.id, id)).limit(1);
    return r ?? null;
  }

  async offers(filter: { sellerId?: string; available?: boolean; limit: number }): Promise<SampleOffer[]> {
    return this.db
      .select()
      .from(sampleOffers)
      .where(and(filter.sellerId ? eq(sampleOffers.sellerId, filter.sellerId) : undefined, filter.available ? and(eq(sampleOffers.active, true), gt(sampleOffers.remaining, 0)) : undefined))
      .orderBy(desc(sampleOffers.createdAt))
      .limit(filter.limit);
  }

  async saveOffer(o: SampleOffer) {
    await this.db.insert(sampleOffers).values(o).onConflictDoUpdate({ target: sampleOffers.id, set: { active: o.active } });
  }

  async take(offerId: string) {
    const rows = await this.db
      .update(sampleOffers)
      .set({ remaining: sql`${sampleOffers.remaining} - 1` })
      .where(and(eq(sampleOffers.id, offerId), eq(sampleOffers.active, true), gt(sampleOffers.remaining, 0)))
      .returning({ id: sampleOffers.id });
    return rows.length > 0;
  }

  async give(offerId: string) {
    await this.db
      .update(sampleOffers)
      .set({ remaining: sql`${sampleOffers.remaining} + 1` })
      .where(eq(sampleOffers.id, offerId));
  }

  async request(id: string) {
    const [r] = await this.db.select().from(sampleRequests).where(eq(sampleRequests.id, id)).limit(1);
    return r ?? null;
  }

  async saveRequest(r: SampleRequest) {
    const values = { ...r, address: { ...r.address } };
    await this.db.insert(sampleRequests).values(values).onConflictDoUpdate({
      target: sampleRequests.id,
      set: { status: r.status, carrier: r.carrier, tracking: r.tracking, reason: r.reason, videoId: r.videoId, shippedAt: r.shippedAt, closedAt: r.closedAt },
    });
  }

  async forCreator(creatorId: string) {
    return this.db.select().from(sampleRequests).where(eq(sampleRequests.creatorId, creatorId)).orderBy(desc(sampleRequests.requestedAt));
  }

  async forSeller(sellerId: string, limit: number) {
    return this.db.select().from(sampleRequests).where(eq(sampleRequests.sellerId, sellerId)).orderBy(desc(sampleRequests.requestedAt)).limit(limit);
  }

  async shippedFor(creatorId: string, slug: string) {
    return this.db
      .select()
      .from(sampleRequests)
      .where(and(eq(sampleRequests.creatorId, creatorId), eq(sampleRequests.slug, slug), eq(sampleRequests.status, "shipped")));
  }

  async overdue(shippedBefore: Date, limit: number) {
    return this.db
      .select()
      .from(sampleRequests)
      .where(and(eq(sampleRequests.status, "shipped"), lt(sampleRequests.shippedAt, shippedBefore)))
      .orderBy(asc(sampleRequests.shippedAt))
      .limit(limit);
  }
}
