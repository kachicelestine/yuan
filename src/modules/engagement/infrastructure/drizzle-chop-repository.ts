import { and, asc, count, desc, eq, gt, gte, inArray, lte, sql } from "drizzle-orm";
import type { Database } from "@/shared/infrastructure/database";
import { cents } from "@/shared/kernel/money";
import type { Chop, ChopCut, ChopOffer, ChopStatus } from "../domain/chop";
import type { ChopRepository } from "../domain/repositories";
import { chopCuts, chopOffers, chops } from "./schema";

const toOffer = (r: typeof chopOffers.$inferSelect): ChopOffer => ({
  id: r.id,
  sellerId: r.sellerId,
  slug: r.slug,
  fullPrice: cents(r.fullPriceCents),
  target: cents(r.targetCents),
  cuts: r.cuts,
  hours: r.hours,
  remaining: r.remaining,
  active: r.active,
  createdAt: r.createdAt,
});

const toChop = (r: typeof chops.$inferSelect): Chop => ({
  id: r.id,
  offerId: r.offerId,
  ownerId: r.ownerId,
  ownerName: r.ownerName,
  slug: r.slug,
  fullPrice: cents(r.fullPriceCents),
  target: cents(r.targetCents),
  cuts: r.cuts,
  startedAt: r.startedAt,
  endsAt: r.endsAt,
  status: r.status,
  doneAt: r.doneAt,
});

export class DrizzleChopRepository implements ChopRepository {
  constructor(private readonly db: Database) {}

  async offer(id: string) {
    const [r] = await this.db.select().from(chopOffers).where(eq(chopOffers.id, id)).limit(1);
    return r ? toOffer(r) : null;
  }

  async offers(filter: { sellerId?: string; startable?: boolean; limit: number }) {
    const rows = await this.db
      .select()
      .from(chopOffers)
      .where(and(filter.sellerId ? eq(chopOffers.sellerId, filter.sellerId) : undefined, filter.startable ? and(eq(chopOffers.active, true), gt(chopOffers.remaining, 0)) : undefined))
      .orderBy(desc(chopOffers.createdAt))
      .limit(filter.limit);
    return rows.map(toOffer);
  }

  async saveOffer(o: ChopOffer) {
    const values = {
      id: o.id,
      sellerId: o.sellerId,
      slug: o.slug,
      fullPriceCents: o.fullPrice,
      targetCents: o.target,
      cuts: o.cuts,
      hours: o.hours,
      remaining: o.remaining,
      active: o.active,
      createdAt: o.createdAt,
    };
    // Stock moves only through reserve/release, never by saving an offer read earlier.
    await this.db.insert(chopOffers).values(values).onConflictDoUpdate({ target: chopOffers.id, set: { active: o.active } });
  }

  async reserve(offerId: string) {
    const rows = await this.db
      .update(chopOffers)
      .set({ remaining: sql`${chopOffers.remaining} - 1` })
      .where(and(eq(chopOffers.id, offerId), eq(chopOffers.active, true), gt(chopOffers.remaining, 0)))
      .returning({ id: chopOffers.id });
    return rows.length > 0;
  }

  async release(offerId: string) {
    await this.db
      .update(chopOffers)
      .set({ remaining: sql`${chopOffers.remaining} + 1` })
      .where(eq(chopOffers.id, offerId));
  }

  async find(id: string) {
    const [r] = await this.db.select().from(chops).where(eq(chops.id, id)).limit(1);
    return r ? toChop(r) : null;
  }

  async lock(id: string) {
    const [r] = await this.db.select().from(chops).where(eq(chops.id, id)).for("update").limit(1);
    return r ? toChop(r) : null;
  }

  async create(c: Chop) {
    const rows = await this.db
      .insert(chops)
      .values({
        id: c.id,
        offerId: c.offerId,
        ownerId: c.ownerId,
        ownerName: c.ownerName,
        slug: c.slug,
        fullPriceCents: c.fullPrice,
        targetCents: c.target,
        cuts: c.cuts,
        startedAt: c.startedAt,
        endsAt: c.endsAt,
        status: c.status,
        doneAt: c.doneAt,
      })
      .onConflictDoNothing()
      .returning({ id: chops.id });
    return rows.length > 0;
  }

  async transition(id: string, from: ChopStatus, to: ChopStatus, doneAt?: Date) {
    const rows = await this.db
      .update(chops)
      .set({ status: to, ...(doneAt ? { doneAt } : {}) })
      .where(and(eq(chops.id, id), eq(chops.status, from)))
      .returning({ id: chops.id });
    return rows.length > 0;
  }

  async openFor(ownerId: string, offerId: string) {
    const [r] = await this.db
      .select()
      .from(chops)
      .where(and(eq(chops.ownerId, ownerId), eq(chops.offerId, offerId), eq(chops.status, "open")))
      .orderBy(desc(chops.startedAt))
      .limit(1);
    return r ? toChop(r) : null;
  }

  async forOwner(ownerId: string, limit: number) {
    return (await this.db.select().from(chops).where(eq(chops.ownerId, ownerId)).orderBy(desc(chops.startedAt)).limit(limit)).map(toChop);
  }

  async cuts(chopId: string): Promise<ChopCut[]> {
    return this.db.select().from(chopCuts).where(eq(chopCuts.chopId, chopId)).orderBy(asc(chopCuts.at));
  }

  async addCut(cut: ChopCut) {
    const rows = await this.db.insert(chopCuts).values(cut).onConflictDoNothing().returning({ chopId: chopCuts.chopId });
    return rows.length > 0;
  }

  async cutsSince(cutter: string, since: Date) {
    const [r] = await this.db
      .select({ n: count() })
      .from(chopCuts)
      .where(and(eq(chopCuts.cutter, cutter), gte(chopCuts.at, since)));
    return r?.n ?? 0;
  }

  async lapsed(at: Date, limit: number) {
    return (
      await this.db
        .select()
        .from(chops)
        .where(and(eq(chops.status, "open"), lte(chops.endsAt, at)))
        .orderBy(asc(chops.endsAt))
        .limit(limit)
    ).map(toChop);
  }

  async done(ownerId: string, slug: string) {
    return (
      await this.db
        .select()
        .from(chops)
        .where(and(eq(chops.ownerId, ownerId), eq(chops.slug, slug), eq(chops.status, "done")))
        .orderBy(desc(chops.doneAt))
    ).map(toChop);
  }

  async stats(offerIds: readonly string[]) {
    if (!offerIds.length) return new Map<string, { started: number; done: number }>();
    const rows = await this.db
      .select({ offerId: chops.offerId, started: count(), done: sql<number>`count(*) filter (where ${chops.status} in ('done', 'used'))::int` })
      .from(chops)
      .where(inArray(chops.offerId, [...offerIds]))
      .groupBy(chops.offerId);
    return new Map(rows.map((r) => [r.offerId, { started: r.started, done: r.done }]));
  }
}
