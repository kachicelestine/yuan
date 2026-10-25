import { and, desc, eq, gt, inArray, isNotNull, lte, or, sql } from "drizzle-orm";
import type { Database } from "@/shared/infrastructure/database";
import type { Box, Case, Series } from "../domain/blindbox";
import type { BlindBoxRepository } from "../domain/repositories";
import { blindBoxes, blindCases, blindHints, blindSeries } from "./schema";

export class DrizzleBlindBoxRepository implements BlindBoxRepository {
  constructor(private readonly db: Database) {}

  async series(id: string) {
    const [s] = await this.db.select().from(blindSeries).where(eq(blindSeries.id, id)).limit(1);
    return s ?? null;
  }

  async seriesFor(slug: string) {
    const [s] = await this.db.select().from(blindSeries).where(and(eq(blindSeries.slug, slug), eq(blindSeries.active, true))).limit(1);
    return s ?? null;
  }

  async activeSeries() {
    return this.db.select().from(blindSeries).where(eq(blindSeries.active, true)).orderBy(desc(blindSeries.createdAt));
  }

  async saveSeries(s: Series) {
    const row = { ...s, figures: [...s.figures] };
    await this.db.insert(blindSeries).values(row).onConflictDoUpdate({ target: blindSeries.id, set: { title: s.title, poster: s.poster, figures: row.figures, secretOdds: s.secretOdds, shakesPerCase: s.shakesPerCase, active: s.active } });
  }

  async latestCase(seriesId: string) {
    const [c] = await this.db.select().from(blindCases).where(eq(blindCases.seriesId, seriesId)).orderBy(desc(blindCases.number)).limit(1);
    return c ?? null;
  }

  async findCase(id: string) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    const [c] = await this.db.select().from(blindCases).where(eq(blindCases.id, id)).limit(1);
    return c ?? null;
  }

  async createCase(c: Case) {
    const rows = await this.db
      .insert(blindCases)
      .values({ ...c, boxes: [...c.boxes] })
      .onConflictDoNothing()
      .returning({ id: blindCases.id });
    return rows.length > 0;
  }

  async boxes(caseIds: readonly string[]) {
    if (!caseIds.length) return [];
    return this.db.select().from(blindBoxes).where(inArray(blindBoxes.caseId, [...caseIds]));
  }

  async hold(box: Box, now: Date) {
    // Insert, or take over a hold that ran out (or refresh the buyer's own); a sold box never moves.
    const rows = await this.db
      .insert(blindBoxes)
      .values(box)
      .onConflictDoUpdate({
        target: [blindBoxes.caseId, blindBoxes.index],
        set: { buyerId: box.buyerId, state: "held", heldUntil: box.heldUntil, at: box.at, orderId: null, openedAt: null },
        setWhere: and(eq(blindBoxes.state, "held"), or(lte(blindBoxes.heldUntil, now), eq(blindBoxes.buyerId, box.buyerId))),
      })
      .returning({ index: blindBoxes.index });
    return rows.length > 0;
  }

  async release(caseId: string, index: number, buyerId: string) {
    await this.db.delete(blindBoxes).where(and(eq(blindBoxes.caseId, caseId), eq(blindBoxes.index, index), eq(blindBoxes.buyerId, buyerId), eq(blindBoxes.state, "held")));
  }

  async heldBy(buyerId: string, now: Date) {
    return this.db.select().from(blindBoxes).where(and(eq(blindBoxes.buyerId, buyerId), eq(blindBoxes.state, "held"), gt(blindBoxes.heldUntil, now)));
  }

  async sell(caseId: string, index: number, buyerId: string, orderId: string, now: Date) {
    // The buyer's own hold, or a box nobody has (assigned at payment).
    const rows = await this.db
      .insert(blindBoxes)
      .values({ caseId, index, buyerId, state: "sold", heldUntil: null, orderId, openedAt: null, at: now })
      .onConflictDoUpdate({
        target: [blindBoxes.caseId, blindBoxes.index],
        set: { buyerId, state: "sold", heldUntil: null, orderId, at: now },
        setWhere: and(eq(blindBoxes.state, "held"), or(eq(blindBoxes.buyerId, buyerId), lte(blindBoxes.heldUntil, now))),
      })
      .returning({ index: blindBoxes.index });
    return rows.length > 0;
  }

  async soldTo(orderId: string) {
    return this.db.select().from(blindBoxes).where(eq(blindBoxes.orderId, orderId));
  }

  async forOrders(orderIds: readonly string[]) {
    if (!orderIds.length) return [];
    return this.db.select().from(blindBoxes).where(and(inArray(blindBoxes.orderId, [...orderIds]), isNotNull(blindBoxes.orderId)));
  }

  async owned(buyerId: string, seriesId: string) {
    const rows = await this.db
      .select({ box: blindBoxes })
      .from(blindBoxes)
      .innerJoin(blindCases, eq(blindCases.id, blindBoxes.caseId))
      .where(and(eq(blindBoxes.buyerId, buyerId), eq(blindBoxes.state, "sold"), eq(blindCases.seriesId, seriesId)))
      .orderBy(desc(blindBoxes.at));
    return rows.map((r) => r.box);
  }

  async markOpened(caseId: string, index: number, buyerId: string, at: Date) {
    const rows = await this.db
      .update(blindBoxes)
      .set({ openedAt: sql`coalesce(${blindBoxes.openedAt}, ${at.toISOString()}::timestamptz)` })
      .where(and(eq(blindBoxes.caseId, caseId), eq(blindBoxes.index, index), eq(blindBoxes.buyerId, buyerId), eq(blindBoxes.state, "sold")))
      .returning({ index: blindBoxes.index });
    return rows.length > 0;
  }

  async hints(caseId: string, buyerId: string) {
    return this.db.select({ index: blindHints.index, figureId: blindHints.figureId }).from(blindHints).where(and(eq(blindHints.caseId, caseId), eq(blindHints.buyerId, buyerId))).orderBy(blindHints.at);
  }

  async addHint(caseId: string, index: number, buyerId: string, figureId: string, at: Date) {
    await this.db.insert(blindHints).values({ caseId, index, buyerId, figureId, at }).onConflictDoNothing();
  }

  async sweep(now: Date) {
    const rows = await this.db.delete(blindBoxes).where(and(eq(blindBoxes.state, "held"), lte(blindBoxes.heldUntil, now))).returning({ index: blindBoxes.index });
    return rows.length;
  }
}
