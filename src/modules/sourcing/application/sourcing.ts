import { domainError, err, ok, type Cents, type Clock, type EventLog, type Result } from "@/shared/kernel";
import { acceptQuote, closeRfq, heldPrice, isOpen, offerQuote, openRfq, quoteRange, withdrawQuote, type Incoterm, type Quote, type QuoteInput, type Rfq, type RfqInput, type SourcingError } from "../domain/rfq";
import type { QuoteRepository, RfqRepository } from "../domain/repositories";

export type SourcingScope = { rfqs: RfqRepository; quotes: QuoteRepository; events: EventLog };

export type SourcingDeps = {
  rfqs: RfqRepository;
  quotes: QuoteRepository;
  /** Catalog-side questions: which shops make something like this, and whether a listing is a shop's. */
  shops: {
    /** Shops whose live listings match the words, best first. */
    match(text: string, limit: number): Promise<string[]>;
    /** The shop selling this live listing, if any. */
    sellerOf(slug: string): Promise<string | null>;
  };
  uow: { run<T>(work: (scope: SourcingScope) => Promise<T>): Promise<T> };
  clock: Clock;
  newId: () => string;
  /** Short public code for a request. */
  newCode: () => string;
};

const dollars = (c: Cents | null) => (c === null ? null : c / 100);

export type QuoteView = {
  id: string;
  sellerId: string;
  slug: string;
  unitPrice: number;
  moq: number;
  leadDays: number;
  sample: number | null;
  note: string;
  status: Quote["status"];
  /** Accepted quotes: the units the held price covers, and until when. */
  range: { min: number; max: number } | null;
  holdUntil: string | null;
  used: boolean;
  updatedAt: string;
};

type RfqBase = {
  id: string;
  code: string;
  item: string;
  details: string;
  slug: string | null;
  qty: number;
  target: number | null;
  port: string;
  incoterm: Incoterm;
  samples: boolean;
  /** "closed" also covers requests whose time ran out. */
  status: "open" | "ordered" | "closed";
  createdAt: string;
  closesAt: string;
};

/** A request as its buyer sees it, with every quote on it. */
export type RfqView = RfqBase & { shops: number; quotes: QuoteView[] };

/** A request as a shop it was sent to sees it: the buyer's handle, and only its own quote. */
export type ShopRfqView = RfqBase & { buyerName: string; quotes: number; mine: QuoteView | null };

export const rfqCode = (id: string) => `RFQ-${id.toUpperCase()}`;

export function makeSourcing({ rfqs, quotes, shops, uow, clock, newId, newCode }: SourcingDeps) {
  const quoteView = (rfq: Rfq, q: Quote): QuoteView => ({
    id: q.id,
    sellerId: q.sellerId,
    slug: q.slug,
    unitPrice: q.unitPrice / 100,
    moq: q.moq,
    leadDays: q.leadDays,
    sample: dollars(q.sample),
    note: q.note,
    status: q.status,
    range: q.status === "accepted" ? quoteRange(rfq, q) : null,
    holdUntil: q.holdUntil?.toISOString() ?? null,
    used: q.usedAt !== null,
    updatedAt: q.updatedAt.toISOString(),
  });

  const base = (r: Rfq): RfqBase => ({
    id: r.id,
    code: rfqCode(r.id),
    item: r.item,
    details: r.details,
    slug: r.slug,
    qty: r.qty,
    target: dollars(r.target),
    port: r.port,
    incoterm: r.incoterm,
    samples: r.samples,
    status: r.status === "open" && !isOpen(r, clock.now()) ? "closed" : r.status,
    createdAt: r.createdAt.toISOString(),
    closesAt: r.closesAt.toISOString(),
  });

  // Withdrawn quotes aren't shown to the buyer; cheapest first.
  const buyerView = (r: Rfq, all: readonly Quote[]): RfqView => ({
    ...base(r),
    shops: r.sellerIds.length,
    quotes: all
      .filter((q) => q.rfqId === r.id && q.status !== "withdrawn")
      .sort((a, b) => a.unitPrice - b.unitPrice)
      .map((q) => quoteView(r, q)),
  });

  const shopView = (r: Rfq, all: readonly Quote[], sellerId: string): ShopRfqView => {
    const mine = all.find((q) => q.rfqId === r.id && q.sellerId === sellerId);
    return { ...base(r), buyerName: r.buyerName, quotes: all.filter((q) => q.rfqId === r.id && q.status !== "withdrawn").length, mine: mine ? quoteView(r, mine) : null };
  };

  async function owned(buyerId: string, id: string) {
    const r = await rfqs.find(id);
    return r && r.buyerId === buyerId ? r : null;
  }

  return {
    /**
     * Sends a request to the shops that make something like it (or, from a product page,
     * to that listing's shop).
     */
    async open(buyer: { accountId: string; name: string }, input: RfqInput): Promise<Result<RfqView, SourcingError>> {
      const now = clock.now();
      let sellerIds: string[];
      let slug: string | null = null;
      if (input.slug) {
        const seller = await shops.sellerOf(input.slug);
        if (!seller) return err(domainError("not_found", "That listing isn't available any more."));
        sellerIds = [seller];
        slug = input.slug;
      } else {
        sellerIds = await shops.match(input.item, 8);
      }
      const opened = openRfq({ id: newCode(), buyer, input: { ...input, slug }, sellerIds, openCount: await rfqs.openCount(buyer.accountId, now), at: now });
      if (!opened.ok) return opened;
      const { rfq, event } = opened.value;
      await uow.run(async (s) => {
        await s.rfqs.save(rfq);
        await s.events.record(rfq.id, event);
      });
      return ok(buyerView(rfq, []));
    },

    async mine(buyerId: string, limit = 30): Promise<RfqView[]> {
      const list = await rfqs.forBuyer(buyerId, limit);
      const all = await quotes.forRfqs(list.map((r) => r.id));
      return list.map((r) => buyerView(r, all));
    },

    async close(buyerId: string, id: string): Promise<Result<RfqView, SourcingError>> {
      const r = await owned(buyerId, id);
      if (!r) return err(domainError("not_found", "No such request."));
      const next = closeRfq(r);
      if (!next.ok) return next;
      await rfqs.save(next.value);
      return ok(buyerView(next.value, await quotes.forRfqs([r.id])));
    },

    /** Takes a quote: its price is held for the buyer, and the other shops are told no. */
    async accept(buyerId: string, quoteId: string): Promise<Result<{ rfq: RfqView; slug: string; price: number; min: number; max: number }, SourcingError>> {
      const q = await quotes.find(quoteId);
      const r = q ? await owned(buyerId, q.rfqId) : null;
      if (!q || !r) return err(domainError("not_found", "No such quote."));
      const all = await quotes.forRfqs([r.id]);
      const accepted = acceptQuote(r, all, quoteId, clock.now());
      if (!accepted.ok) return accepted;
      const { rfq, quotes: next, event } = accepted.value;
      await uow.run(async (s) => {
        await s.rfqs.save(rfq);
        for (const x of next) if (all.find((o) => o.id === x.id) !== x) await s.quotes.save(x);
        await s.events.record(rfq.id, event);
      });
      const range = quoteRange(rfq, q);
      return ok({ rfq: buyerView(rfq, next), slug: q.slug, price: q.unitPrice / 100, ...range });
    },

    /** Requests sent to a shop: open ones first, then the rest, newest first. */
    async inbox(sellerId: string, limit = 50): Promise<ShopRfqView[]> {
      const list = await rfqs.forSeller(sellerId, limit);
      const all = await quotes.forRfqs(list.map((r) => r.id));
      const views = list.map((r) => shopView(r, all, sellerId));
      return [...views.filter((v) => v.status === "open"), ...views.filter((v) => v.status !== "open")];
    },

    async forShop(sellerId: string, id: string): Promise<ShopRfqView | null> {
      const r = await rfqs.find(id);
      if (!r || !r.sellerIds.includes(sellerId)) return null;
      return shopView(r, await quotes.forRfqs([r.id]), sellerId);
    },

    /** A shop's quote on a request it was sent (sending again revises it). */
    async quote(sellerId: string, rfqId: string, input: QuoteInput): Promise<Result<ShopRfqView, SourcingError>> {
      const r = await rfqs.find(rfqId);
      if (!r || !r.sellerIds.includes(sellerId)) return err(domainError("not_found", "No such request."));
      if ((await shops.sellerOf(input.slug)) !== sellerId) return err(domainError("invalid_quote", "Quote one of your own live listings."));
      const offered = offerQuote({ rfq: r, sellerId, existing: await quotes.bySeller(rfqId, sellerId), id: newId(), input, at: clock.now() });
      if (!offered.ok) return offered;
      await uow.run(async (s) => {
        await s.quotes.save(offered.value.quote);
        await s.events.record(r.id, offered.value.event);
      });
      return ok(shopView(r, await quotes.forRfqs([r.id]), sellerId));
    },

    async withdraw(sellerId: string, rfqId: string): Promise<Result<ShopRfqView, SourcingError>> {
      const r = await rfqs.find(rfqId);
      const q = r ? await quotes.bySeller(rfqId, sellerId) : null;
      if (!r || !q) return err(domainError("not_found", "No such quote."));
      const next = withdrawQuote(q, clock.now());
      if (!next.ok) return next;
      await quotes.save(next.value);
      return ok(shopView(r, await quotes.forRfqs([r.id]), sellerId));
    },

    /** The lowest accepted-quote price this buyer holds for a listing that covers `qty`. */
    async bestHold(buyerId: string, slug: string, qty: number): Promise<{ price: Cents; qty: number; minQty: number } | null> {
      const now = clock.now();
      const held = (await quotes.held(buyerId, slug, now)).flatMap(({ rfq, quote }) => heldPrice(rfq, quote, now) ?? []).filter((h) => qty >= h.minQty && qty <= h.qty);
      return held.length ? held.reduce((a, b) => (b.price < a.price ? b : a)) : null;
    },

    /** A paid order uses up the quoted prices behind it. */
    async use(buyerId: string, slugs: readonly string[]) {
      return slugs.length ? quotes.use(buyerId, slugs, clock.now()) : 0;
    },

    /** Closes requests whose time ran out. */
    async expire() {
      return rfqs.expire(clock.now());
    },
  };
}

export type Sourcing = ReturnType<typeof makeSourcing>;
