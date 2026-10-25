import { and, asc, eq, gt, inArray, isNull, lte, sql } from "drizzle-orm";
import type { Database } from "@/shared/infrastructure/database";
import { money } from "@/shared/kernel";
import type { Deposit, DepositOffer, DepositStatus } from "../domain/deposit";
import type { DepositRepository } from "../domain/repositories";
import { depositOffers, deposits } from "./schema";

type OfferRow = typeof depositOffers.$inferSelect;

const toOffer = (r: OfferRow): DepositOffer => ({
  id: r.id,
  sellerId: r.sellerId,
  slug: r.slug,
  kind: r.kind,
  title: r.title,
  blurb: r.blurb,
  deposit: money.cents(r.depositCents),
  credit: money.cents(r.creditCents),
  price: money.cents(r.priceCents),
  opensAt: r.opensAt,
  closesAt: r.closesAt,
  balanceFrom: r.balanceFrom,
  balanceUntil: r.balanceUntil,
  stock: r.stock,
  perPerson: r.perPerson,
  taken: r.taken,
  cancelled: r.cancelled,
  createdAt: r.createdAt,
});

const offerRow = (o: DepositOffer) => ({ ...o, depositCents: o.deposit, creditCents: o.credit, priceCents: o.price });

export class DrizzleDepositRepository implements DepositRepository {
  constructor(private readonly db: Database) {}

  async offer(id: string) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    const [r] = await this.db.select().from(depositOffers).where(eq(depositOffers.id, id)).limit(1);
    return r ? toOffer(r) : null;
  }

  async saveOffer(o: DepositOffer) {
    await this.db.insert(depositOffers).values(offerRow(o)).onConflictDoUpdate({ target: depositOffers.id, set: { cancelled: o.cancelled, title: o.title, blurb: o.blurb } });
  }

  async sellerOffers(sellerId: string) {
    return (await this.db.select().from(depositOffers).where(eq(depositOffers.sellerId, sellerId)).orderBy(asc(depositOffers.balanceFrom))).map(toOffer);
  }

  async currentOffers(now: Date) {
    return (await this.db.select().from(depositOffers).where(and(eq(depositOffers.cancelled, false), gt(depositOffers.balanceUntil, now))).orderBy(asc(depositOffers.closesAt))).map(toOffer);
  }

  async find(id: string) {
    const [r] = await this.db.select().from(deposits).where(eq(deposits.id, id)).limit(1);
    return r ?? null;
  }

  async byOrder(orderId: string) {
    const [r] = await this.db.select().from(deposits).where(eq(deposits.orderId, orderId)).limit(1);
    return r ?? null;
  }

  async reserve(d: Deposit) {
    return this.db.transaction(async (tx) => {
      const taken = await tx
        .update(depositOffers)
        .set({ taken: sql`${depositOffers.taken} + 1` })
        .where(and(eq(depositOffers.id, d.offerId), sql`${depositOffers.taken} < ${depositOffers.stock}`, eq(depositOffers.cancelled, false)))
        .returning({ id: depositOffers.id });
      if (!taken.length) return false;
      await tx.insert(deposits).values(d);
      return true;
    });
  }

  async save(d: Deposit) {
    await this.db.insert(deposits).values(d).onConflictDoUpdate({ target: deposits.id, set: { orderId: d.orderId, status: d.status, finalOrderId: d.finalOrderId, paidAt: d.paidAt, remindedAt: d.remindedAt } });
  }

  async release(d: Deposit) {
    await this.db.transaction(async (tx) => {
      const rows = await tx
        .update(deposits)
        .set({ status: "lapsed" })
        .where(and(eq(deposits.id, d.id), eq(deposits.status, "pending")))
        .returning({ id: deposits.id });
      if (rows.length) await tx.update(depositOffers).set({ taken: sql`greatest(${depositOffers.taken} - 1, 0)` }).where(eq(depositOffers.id, d.offerId));
    });
  }

  private async withOffers(rows: Deposit[]) {
    if (!rows.length) return [];
    const offers = new Map((await this.db.select().from(depositOffers).where(inArray(depositOffers.id, [...new Set(rows.map((r) => r.offerId))]))).map((o) => [o.id, toOffer(o)]));
    return rows.flatMap((deposit) => {
      const offer = offers.get(deposit.offerId);
      return offer ? [{ deposit, offer }] : [];
    });
  }

  async forBuyer(buyerId: string) {
    return this.withOffers(await this.db.select().from(deposits).where(eq(deposits.buyerId, buyerId)).orderBy(asc(deposits.createdAt)));
  }

  async forOffer(offerId: string, statuses: readonly DepositStatus[]) {
    return this.db.select().from(deposits).where(and(eq(deposits.offerId, offerId), inArray(deposits.status, [...statuses])));
  }

  async forFinalOrder(orderId: string) {
    return this.withOffers(await this.db.select().from(deposits).where(eq(deposits.finalOrderId, orderId)));
  }

  async lapsed(now: Date) {
    const rows = await this.db
      .select({ deposit: deposits })
      .from(deposits)
      .innerJoin(depositOffers, eq(depositOffers.id, deposits.offerId))
      .where(and(eq(deposits.status, "paid"), lte(depositOffers.balanceUntil, now)))
      .limit(200);
    return this.withOffers(rows.map((r) => r.deposit));
  }

  async toRemind(now: Date) {
    const rows = await this.db
      .select({ deposit: deposits })
      .from(deposits)
      .innerJoin(depositOffers, eq(depositOffers.id, deposits.offerId))
      .where(and(eq(deposits.status, "paid"), isNull(deposits.remindedAt), lte(depositOffers.balanceFrom, now), gt(depositOffers.balanceUntil, now), eq(depositOffers.cancelled, false)))
      .limit(200);
    return this.withOffers(rows.map((r) => r.deposit));
  }
}
