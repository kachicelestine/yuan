import { and, asc, desc, eq, gt, inArray, isNull, lte, sql } from "drizzle-orm";
import type { Database } from "@/shared/infrastructure/database";
import { cents } from "@/shared/kernel/money";
import type { Lot } from "../domain/auction";
import type { ChatMessage } from "../domain/chat";
import type { PriceHold } from "../domain/hold";
import type { ChatRepository, HoldRepository, LotRepository, ShowRepository } from "../domain/repositories";
import type { Show, ShowStatus } from "../domain/show";
import { chatMessages, holds, lots, shows } from "./schema";

const toShow = (r: typeof shows.$inferSelect): Show => ({
  ...r,
  items: r.items.map((i) => ({ slug: i.slug, status: i.status, livePrice: i.livePriceCents === null ? null : cents(i.livePriceCents) })),
  pinned: r.pinned ?? null,
});

export class DrizzleShowRepository implements ShowRepository {
  constructor(private readonly db: Database) {}

  async find(id: string) {
    const [r] = await this.db.select().from(shows).where(eq(shows.id, id)).limit(1);
    return r ? toShow(r) : null;
  }

  async save(s: Show) {
    const row = { ...s, items: s.items.map((i) => ({ slug: i.slug, status: i.status, livePriceCents: i.livePrice })) };
    await this.db.insert(shows).values(row).onConflictDoUpdate({ target: shows.id, set: row });
  }

  async list(status: ShowStatus, limit: number) {
    const order = status === "live" ? [desc(shows.peakViewers), asc(shows.startedAt)] : status === "scheduled" ? [asc(shows.scheduledFor)] : [desc(shows.endedAt)];
    return (await this.db.select().from(shows).where(eq(shows.status, status)).orderBy(...order).limit(limit)).map(toShow);
  }

  async forSeller(sellerId: string, limit: number) {
    return (await this.db.select().from(shows).where(eq(shows.sellerId, sellerId)).orderBy(desc(shows.scheduledFor)).limit(limit)).map(toShow);
  }

  async notePeak(id: string, viewers: number) {
    await this.db.update(shows).set({ peakViewers: sql`greatest(${shows.peakViewers}, ${viewers})` }).where(eq(shows.id, id));
  }
}

export class DrizzleChatRepository implements ChatRepository {
  constructor(private readonly db: Database) {}

  async add(m: ChatMessage) {
    await this.db.insert(chatMessages).values(m);
  }

  async recent(showId: string, limit: number) {
    const rows = await this.db.select().from(chatMessages).where(eq(chatMessages.showId, showId)).orderBy(desc(chatMessages.at)).limit(limit);
    return rows.reverse();
  }
}

const toLot = (r: typeof lots.$inferSelect): Lot => ({
  id: r.id,
  showId: r.showId,
  slug: r.slug,
  startPrice: cents(r.startPriceCents),
  increment: cents(r.incrementCents),
  endsAt: r.endsAt,
  status: r.status,
  topBid: r.topBid && { amount: cents(r.topBid.amountCents), bidderId: r.topBid.bidderId, bidderName: r.topBid.bidderName, at: new Date(r.topBid.at) },
  bids: r.bids,
  version: r.version,
});

const toLotRow = (l: Lot) => ({
  id: l.id,
  showId: l.showId,
  slug: l.slug,
  startPriceCents: l.startPrice,
  incrementCents: l.increment,
  endsAt: l.endsAt,
  status: l.status,
  topBid: l.topBid && { amountCents: l.topBid.amount, bidderId: l.topBid.bidderId, bidderName: l.topBid.bidderName, at: l.topBid.at.toISOString() },
  bids: l.bids,
  version: l.version,
});

export class DrizzleLotRepository implements LotRepository {
  constructor(private readonly db: Database) {}

  async find(id: string) {
    const [r] = await this.db.select().from(lots).where(eq(lots.id, id)).limit(1);
    return r ? toLot(r) : null;
  }

  async forShow(showId: string) {
    return (await this.db.select().from(lots).where(eq(lots.showId, showId)).orderBy(asc(lots.endsAt))).map(toLot);
  }

  async insert(l: Lot) {
    await this.db.insert(lots).values(toLotRow(l));
  }

  async update(l: Lot) {
    const rows = await this.db
      .update(lots)
      .set(toLotRow(l))
      .where(and(eq(lots.id, l.id), eq(lots.version, l.version - 1)))
      .returning({ id: lots.id });
    return rows.length > 0;
  }

  async due(at: Date, limit: number) {
    return (await this.db.select().from(lots).where(and(eq(lots.status, "open"), lte(lots.endsAt, at))).orderBy(asc(lots.endsAt)).limit(limit)).map(toLot);
  }
}

const toHold = (r: typeof holds.$inferSelect): PriceHold => ({ ...r, price: cents(r.priceCents) });

export class DrizzleHoldRepository implements HoldRepository {
  constructor(private readonly db: Database) {}

  async add(h: PriceHold) {
    await this.db.insert(holds).values({ id: h.id, accountId: h.accountId, slug: h.slug, priceCents: h.price, qty: h.qty, source: h.source, expiresAt: h.expiresAt, usedAt: h.usedAt, createdAt: h.createdAt });
  }

  async best(accountId: string, slug: string, at: Date) {
    const [r] = await this.db
      .select()
      .from(holds)
      .where(and(eq(holds.accountId, accountId), eq(holds.slug, slug), isNull(holds.usedAt), gt(holds.expiresAt, at)))
      .orderBy(asc(holds.priceCents))
      .limit(1);
    return r ? toHold(r) : null;
  }

  async use(accountId: string, slugs: readonly string[], at: Date) {
    if (!slugs.length) return 0;
    const rows = await this.db
      .update(holds)
      .set({ usedAt: at })
      .where(and(eq(holds.accountId, accountId), inArray(holds.slug, [...slugs]), isNull(holds.usedAt), gt(holds.expiresAt, at)))
      .returning({ id: holds.id });
    return rows.length;
  }
}
