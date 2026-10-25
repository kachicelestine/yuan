import { and, arrayContains, count, desc, eq, gt, inArray, isNull, lte, sql } from "drizzle-orm";
import type { Database } from "@/shared/infrastructure/database";
import { money } from "@/shared/kernel";
import type { Quote, Rfq } from "../domain/rfq";
import type { QuoteRepository, RfqRepository } from "../domain/repositories";
import { quotes, rfqs } from "./schema";

type RfqRow = typeof rfqs.$inferSelect;
type QuoteRow = typeof quotes.$inferSelect;

const toRfq = (r: RfqRow): Rfq => ({
  id: r.id,
  buyerId: r.buyerId,
  buyerName: r.buyerName,
  item: r.item,
  details: r.details,
  slug: r.slug,
  qty: r.qty,
  target: r.targetCents === null ? null : money.cents(r.targetCents),
  port: r.port,
  incoterm: r.incoterm,
  samples: r.samples,
  sellerIds: r.sellerIds,
  status: r.status,
  createdAt: r.createdAt,
  closesAt: r.closesAt,
});

const toQuote = (q: QuoteRow): Quote => ({
  id: q.id,
  rfqId: q.rfqId,
  sellerId: q.sellerId,
  slug: q.slug,
  unitPrice: money.cents(q.unitPriceCents),
  moq: q.moq,
  leadDays: q.leadDays,
  sample: q.sampleCents === null ? null : money.cents(q.sampleCents),
  note: q.note,
  status: q.status,
  createdAt: q.createdAt,
  updatedAt: q.updatedAt,
  holdUntil: q.holdUntil,
  usedAt: q.usedAt,
});

export class DrizzleRfqRepository implements RfqRepository {
  constructor(private readonly db: Database) {}

  async find(id: string) {
    const [r] = await this.db.select().from(rfqs).where(eq(rfqs.id, id)).limit(1);
    return r ? toRfq(r) : null;
  }

  async save(r: Rfq) {
    const row = { ...r, sellerIds: [...r.sellerIds], targetCents: r.target };
    await this.db.insert(rfqs).values(row).onConflictDoUpdate({ target: rfqs.id, set: { status: r.status } });
  }

  async forBuyer(buyerId: string, limit: number) {
    return (await this.db.select().from(rfqs).where(eq(rfqs.buyerId, buyerId)).orderBy(desc(rfqs.createdAt)).limit(limit)).map(toRfq);
  }

  async openCount(buyerId: string, now: Date) {
    const [{ n }] = await this.db.select({ n: count() }).from(rfqs).where(and(eq(rfqs.buyerId, buyerId), eq(rfqs.status, "open"), gt(rfqs.closesAt, now)));
    return n;
  }

  async forSeller(sellerId: string, limit: number) {
    return (await this.db.select().from(rfqs).where(arrayContains(rfqs.sellerIds, [sellerId])).orderBy(desc(rfqs.createdAt)).limit(limit)).map(toRfq);
  }

  async expire(now: Date) {
    const rows = await this.db.update(rfqs).set({ status: "closed" }).where(and(eq(rfqs.status, "open"), lte(rfqs.closesAt, now))).returning({ id: rfqs.id });
    return rows.length;
  }
}

export class DrizzleQuoteRepository implements QuoteRepository {
  constructor(private readonly db: Database) {}

  async find(id: string) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
    const [q] = await this.db.select().from(quotes).where(eq(quotes.id, id)).limit(1);
    return q ? toQuote(q) : null;
  }

  async forRfqs(rfqIds: readonly string[]) {
    if (!rfqIds.length) return [];
    return (await this.db.select().from(quotes).where(inArray(quotes.rfqId, [...rfqIds])).orderBy(quotes.createdAt)).map(toQuote);
  }

  async bySeller(rfqId: string, sellerId: string) {
    const [q] = await this.db.select().from(quotes).where(and(eq(quotes.rfqId, rfqId), eq(quotes.sellerId, sellerId))).limit(1);
    return q ? toQuote(q) : null;
  }

  async save(q: Quote) {
    const row = { ...q, unitPriceCents: q.unitPrice, sampleCents: q.sample };
    await this.db
      .insert(quotes)
      .values(row)
      .onConflictDoUpdate({
        target: quotes.id,
        set: { slug: q.slug, unitPriceCents: q.unitPrice, moq: q.moq, leadDays: q.leadDays, sampleCents: q.sample, note: q.note, status: q.status, updatedAt: q.updatedAt, holdUntil: q.holdUntil, usedAt: q.usedAt },
      });
  }

  async held(buyerId: string, slug: string, now: Date) {
    const rows = await this.db
      .select({ rfq: rfqs, quote: quotes })
      .from(quotes)
      .innerJoin(rfqs, eq(rfqs.id, quotes.rfqId))
      .where(and(eq(quotes.slug, slug), eq(quotes.status, "accepted"), isNull(quotes.usedAt), gt(quotes.holdUntil, now), eq(rfqs.buyerId, buyerId)));
    return rows.map((r) => ({ rfq: toRfq(r.rfq), quote: toQuote(r.quote) }));
  }

  async use(buyerId: string, slugs: readonly string[], at: Date) {
    const rows = await this.db
      .update(quotes)
      .set({ usedAt: at })
      .where(
        and(
          inArray(quotes.slug, [...slugs]),
          eq(quotes.status, "accepted"),
          isNull(quotes.usedAt),
          gt(quotes.holdUntil, at),
          sql`${quotes.rfqId} in (select ${rfqs.id} from ${rfqs} where ${rfqs.buyerId} = ${buyerId})`,
        ),
      )
      .returning({ id: quotes.id });
    return rows.length;
  }
}
