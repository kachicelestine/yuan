import { and, asc, count, desc, eq, gt, gte, inArray, isNull, lte, sql } from "drizzle-orm";
import type { Database } from "@/shared/infrastructure/database";
import { cents } from "@/shared/kernel/money";
import type { Drop, Team, TeamMember, TeamOffer, TeamStatus } from "../domain/drop";
import type { DropRepository, PromoHold, PromoHoldRepository, Reminder, ReminderRepository, TeamRepository } from "../domain/repositories";
import { drops, promoHolds, reminders, teamMembers, teamOffers, teams } from "./schema";

const toDrop = (r: typeof drops.$inferSelect): Drop => ({
  id: r.id,
  sellerId: r.sellerId,
  slug: r.slug,
  kind: r.kind,
  title: r.title,
  blurb: r.blurb,
  startsAt: r.startsAt,
  endsAt: r.endsAt,
  price: r.priceCents === null ? null : cents(r.priceCents),
  stock: r.stock,
  perPerson: r.perPerson,
  claimed: r.claimed,
  cancelled: r.cancelled,
  createdAt: r.createdAt,
});

export class DrizzleDropRepository implements DropRepository {
  constructor(private readonly db: Database) {}

  async find(id: string) {
    const [r] = await this.db.select().from(drops).where(eq(drops.id, id)).limit(1);
    return r ? toDrop(r) : null;
  }

  async save(d: Drop) {
    await this.db
      .insert(drops)
      .values({
        id: d.id,
        sellerId: d.sellerId,
        slug: d.slug,
        kind: d.kind,
        title: d.title,
        blurb: d.blurb,
        startsAt: d.startsAt,
        endsAt: d.endsAt,
        priceCents: d.price,
        stock: d.stock,
        perPerson: d.perPerson,
        claimed: d.claimed,
        cancelled: d.cancelled,
        createdAt: d.createdAt,
      })
      .onConflictDoUpdate({ target: drops.id, set: { cancelled: d.cancelled } });
  }

  async list(filter: { from?: Date; sellerId?: string; limit: number }) {
    const rows = await this.db
      .select()
      .from(drops)
      .where(and(filter.from ? and(gt(drops.endsAt, filter.from), eq(drops.cancelled, false)) : undefined, filter.sellerId ? eq(drops.sellerId, filter.sellerId) : undefined))
      .orderBy(filter.sellerId ? desc(drops.startsAt) : asc(drops.startsAt))
      .limit(filter.limit);
    return rows.map(toDrop);
  }

  async take(id: string, qty: number) {
    const rows = await this.db
      .update(drops)
      .set({ claimed: sql`${drops.claimed} + ${qty}` })
      .where(and(eq(drops.id, id), sql`(${drops.stock} is null or ${drops.claimed} + ${qty} <= ${drops.stock})`))
      .returning({ id: drops.id });
    return rows.length > 0;
  }

  async give(id: string, qty: number) {
    await this.db
      .update(drops)
      .set({ claimed: sql`greatest(0, ${drops.claimed} - ${qty})` })
      .where(eq(drops.id, id));
  }
}

const toHold = (r: typeof promoHolds.$inferSelect): PromoHold => ({
  id: r.id,
  accountId: r.accountId,
  slug: r.slug,
  price: r.priceCents,
  qty: r.qty,
  source: r.source,
  sourceId: r.sourceId,
  expiresAt: r.expiresAt,
  usedAt: r.usedAt,
});

export class DrizzlePromoHoldRepository implements PromoHoldRepository {
  constructor(private readonly db: Database) {}

  async add(h: PromoHold) {
    await this.db.insert(promoHolds).values({ id: h.id, accountId: h.accountId, slug: h.slug, priceCents: h.price, qty: h.qty, source: h.source, sourceId: h.sourceId, expiresAt: h.expiresAt, usedAt: h.usedAt });
  }

  async taken(accountId: string, source: PromoHold["source"], sourceId: string) {
    // Held now or bought; holds that lapsed unused don't count.
    const [r] = await this.db
      .select({ n: sql<number>`coalesce(sum(${promoHolds.qty}), 0)::int` })
      .from(promoHolds)
      .where(and(eq(promoHolds.accountId, accountId), eq(promoHolds.source, source), eq(promoHolds.sourceId, sourceId), isNull(promoHolds.retiredAt)));
    return r?.n ?? 0;
  }

  async best(accountId: string, slug: string, at: Date) {
    const [r] = await this.db
      .select()
      .from(promoHolds)
      .where(and(eq(promoHolds.accountId, accountId), eq(promoHolds.slug, slug), isNull(promoHolds.usedAt), gt(promoHolds.expiresAt, at)))
      .orderBy(asc(promoHolds.priceCents))
      .limit(1);
    return r ? toHold(r) : null;
  }

  async use(accountId: string, slugs: readonly string[], at: Date) {
    if (!slugs.length) return;
    await this.db
      .update(promoHolds)
      .set({ usedAt: at })
      .where(and(eq(promoHolds.accountId, accountId), inArray(promoHolds.slug, [...slugs]), isNull(promoHolds.usedAt), gt(promoHolds.expiresAt, at)));
  }

  async lapsed(at: Date, limit: number) {
    return (
      await this.db
        .select()
        .from(promoHolds)
        .where(and(isNull(promoHolds.usedAt), isNull(promoHolds.retiredAt), lte(promoHolds.expiresAt, at)))
        .orderBy(asc(promoHolds.expiresAt))
        .limit(limit)
    ).map(toHold);
  }

  async retire(id: string) {
    const rows = await this.db
      .update(promoHolds)
      .set({ retiredAt: new Date() })
      .where(and(eq(promoHolds.id, id), isNull(promoHolds.retiredAt), isNull(promoHolds.usedAt)))
      .returning({ id: promoHolds.id });
    return rows.length > 0;
  }
}

const toOffer = (r: typeof teamOffers.$inferSelect): TeamOffer => ({
  id: r.id,
  sellerId: r.sellerId,
  slug: r.slug,
  fullPrice: cents(r.fullPriceCents),
  teamPrice: cents(r.teamPriceCents),
  size: r.size,
  hours: r.hours,
  remaining: r.remaining,
  active: r.active,
  createdAt: r.createdAt,
});

const toTeam = (r: typeof teams.$inferSelect): Team => ({
  id: r.id,
  offerId: r.offerId,
  slug: r.slug,
  leaderId: r.leaderId,
  leaderName: r.leaderName,
  teamPrice: cents(r.teamPriceCents),
  size: r.size,
  startedAt: r.startedAt,
  endsAt: r.endsAt,
  status: r.status,
  fullAt: r.fullAt,
});

export class DrizzleTeamRepository implements TeamRepository {
  constructor(private readonly db: Database) {}

  async offer(id: string) {
    const [r] = await this.db.select().from(teamOffers).where(eq(teamOffers.id, id)).limit(1);
    return r ? toOffer(r) : null;
  }

  async offers(filter: { sellerId?: string; startable?: boolean; limit: number }) {
    const rows = await this.db
      .select()
      .from(teamOffers)
      .where(and(filter.sellerId ? eq(teamOffers.sellerId, filter.sellerId) : undefined, filter.startable ? and(eq(teamOffers.active, true), gt(teamOffers.remaining, 0)) : undefined))
      .orderBy(desc(teamOffers.createdAt))
      .limit(filter.limit);
    return rows.map(toOffer);
  }

  async saveOffer(o: TeamOffer) {
    await this.db
      .insert(teamOffers)
      .values({ id: o.id, sellerId: o.sellerId, slug: o.slug, fullPriceCents: o.fullPrice, teamPriceCents: o.teamPrice, size: o.size, hours: o.hours, remaining: o.remaining, active: o.active, createdAt: o.createdAt })
      .onConflictDoUpdate({ target: teamOffers.id, set: { active: o.active } });
  }

  async reserve(offerId: string) {
    const rows = await this.db
      .update(teamOffers)
      .set({ remaining: sql`${teamOffers.remaining} - 1` })
      .where(and(eq(teamOffers.id, offerId), eq(teamOffers.active, true), gt(teamOffers.remaining, 0)))
      .returning({ id: teamOffers.id });
    return rows.length > 0;
  }

  async release(offerId: string) {
    await this.db
      .update(teamOffers)
      .set({ remaining: sql`${teamOffers.remaining} + 1` })
      .where(eq(teamOffers.id, offerId));
  }

  async find(id: string) {
    const [r] = await this.db.select().from(teams).where(eq(teams.id, id)).limit(1);
    return r ? toTeam(r) : null;
  }

  async lock(id: string) {
    const [r] = await this.db.select().from(teams).where(eq(teams.id, id)).for("update").limit(1);
    return r ? toTeam(r) : null;
  }

  async create(t: Team) {
    const rows = await this.db
      .insert(teams)
      .values({ id: t.id, offerId: t.offerId, slug: t.slug, leaderId: t.leaderId, leaderName: t.leaderName, teamPriceCents: t.teamPrice, size: t.size, startedAt: t.startedAt, endsAt: t.endsAt, status: t.status, fullAt: t.fullAt })
      .onConflictDoNothing()
      .returning({ id: teams.id });
    return rows.length > 0;
  }

  async transition(id: string, from: TeamStatus, to: TeamStatus, fullAt?: Date) {
    const rows = await this.db
      .update(teams)
      .set({ status: to, ...(fullAt ? { fullAt } : {}) })
      .where(and(eq(teams.id, id), eq(teams.status, from)))
      .returning({ id: teams.id });
    return rows.length > 0;
  }

  async members(teamId: string): Promise<TeamMember[]> {
    return this.db.select().from(teamMembers).where(eq(teamMembers.teamId, teamId)).orderBy(asc(teamMembers.at));
  }

  async addMember(m: TeamMember) {
    const rows = await this.db.insert(teamMembers).values(m).onConflictDoNothing().returning({ id: teamMembers.teamId });
    return rows.length > 0;
  }

  async open(offerIds: readonly string[], at: Date, limit: number) {
    if (!offerIds.length) return [];
    return (
      await this.db
        .select()
        .from(teams)
        .where(and(inArray(teams.offerId, [...offerIds]), eq(teams.status, "open"), gt(teams.endsAt, at)))
        .orderBy(asc(teams.endsAt))
        .limit(limit)
    ).map(toTeam);
  }

  async openFor(accountId: string, offerId: string, at: Date) {
    const [r] = await this.db
      .select({ team: teams })
      .from(teams)
      .innerJoin(teamMembers, eq(teamMembers.teamId, teams.id))
      .where(and(eq(teams.offerId, offerId), eq(teamMembers.accountId, accountId), eq(teams.status, "open"), gt(teams.endsAt, at)))
      .limit(1);
    return r ? toTeam(r.team) : null;
  }

  async lapsed(at: Date, limit: number) {
    return (
      await this.db
        .select()
        .from(teams)
        .where(and(eq(teams.status, "open"), lte(teams.endsAt, at)))
        .orderBy(asc(teams.endsAt))
        .limit(limit)
    ).map(toTeam);
  }

  async stats(offerIds: readonly string[]) {
    if (!offerIds.length) return new Map<string, { started: number; full: number }>();
    const rows = await this.db
      .select({ offerId: teams.offerId, started: count(), full: sql<number>`count(*) filter (where ${teams.status} = 'full')::int` })
      .from(teams)
      .where(inArray(teams.offerId, [...offerIds]))
      .groupBy(teams.offerId);
    return new Map(rows.map((r) => [r.offerId, { started: r.started, full: r.full }]));
  }
}

export class DrizzleReminderRepository implements ReminderRepository {
  constructor(private readonly db: Database) {}

  async set(r: Reminder) {
    await this.db
      .insert(reminders)
      .values({ ...r, sentAt: null })
      .onConflictDoUpdate({ target: [reminders.key, reminders.accountId], set: { at: r.at, title: r.title, link: r.link } });
  }

  async unset(key: string, accountId: string) {
    await this.db.delete(reminders).where(and(eq(reminders.key, key), eq(reminders.accountId, accountId)));
  }

  async mine(accountId: string, keys: readonly string[]) {
    if (!keys.length) return new Set<string>();
    return new Set((await this.db.select({ key: reminders.key }).from(reminders).where(and(eq(reminders.accountId, accountId), inArray(reminders.key, [...keys])))).map((r) => r.key));
  }

  async counts(keys: readonly string[]) {
    if (!keys.length) return new Map<string, number>();
    const rows = await this.db
      .select({ key: reminders.key, n: count() })
      .from(reminders)
      .where(inArray(reminders.key, [...keys]))
      .groupBy(reminders.key);
    return new Map(rows.map((r) => [r.key, r.n]));
  }

  async due(until: Date, limit: number) {
    return this.db
      .select({ key: reminders.key, accountId: reminders.accountId, at: reminders.at, title: reminders.title, link: reminders.link })
      .from(reminders)
      .where(and(isNull(reminders.sentAt), lte(reminders.at, until), gte(reminders.at, new Date(until.getTime() - 86_400_000))))
      .orderBy(asc(reminders.at))
      .limit(limit);
  }

  async markSent(key: string, accountId: string, at: Date) {
    const rows = await this.db
      .update(reminders)
      .set({ sentAt: at })
      .where(and(eq(reminders.key, key), eq(reminders.accountId, accountId), isNull(reminders.sentAt)))
      .returning({ key: reminders.key });
    return rows.length > 0;
  }

  async removeKey(key: string) {
    await this.db.delete(reminders).where(eq(reminders.key, key));
  }
}

