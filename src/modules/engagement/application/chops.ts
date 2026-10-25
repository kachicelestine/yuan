import { domainError, err, money, ok, type Cents, type Clock, type EventLog, type Result } from "@/shared/kernel";
import { canCut, cutSize, heldPrice, holdsUntil, makeOffer, priceAfter, startChop, type Chop, type ChopCompleted, type ChopError, type ChopOffer } from "../domain/chop";
import type { ChopRepository } from "../domain/repositories";

/** A shop's live listing and its price (catalog owns listings). */
export interface ChopProducts {
  livePrice(sellerId: string, slug: string): Promise<Cents | null>;
}

export type ChopScope = { chops: ChopRepository; events: EventLog };

export type ChopsDeps = {
  chops: ChopRepository;
  products: ChopProducts;
  uow: { run<T>(work: (scope: ChopScope) => Promise<T>): Promise<T> };
  clock: Clock;
  newId: () => string;
  newCode: () => string;
};

export type ChopOfferView = { id: string; sellerId: string; slug: string; fullPrice: number; target: number; cuts: number; hours: number; remaining: number; active: boolean; started?: number; done?: number };

export type ChopView = {
  id: string;
  slug: string;
  ownerName: string;
  yours: boolean;
  fullPrice: number;
  target: number;
  cuts: number;
  done: number;
  price: number;
  cutSize: number;
  endsAt: string;
  status: "open" | "done" | "expired" | "used";
  /** Until when the owner can buy at the target. */
  holdsUntil: string | null;
  cutters: string[];
  youCut: boolean;
};

const dollars = (c: number) => c / 100;
const DAY = 86_400_000;

const offerView = (o: ChopOffer, s?: { started: number; done: number }): ChopOfferView => ({
  id: o.id,
  sellerId: o.sellerId,
  slug: o.slug,
  fullPrice: dollars(o.fullPrice),
  target: dollars(o.target),
  cuts: o.cuts,
  hours: o.hours,
  remaining: o.remaining,
  active: o.active,
  ...(s ? { started: s.started, done: s.done } : {}),
});

export function makeChops({ chops, products, uow, clock, newId, newCode }: ChopsDeps) {
  async function view(c: Chop, viewer: { cutter: string | null; accountId: string | null }): Promise<ChopView> {
    const cuts = await chops.cuts(c.id);
    const now = clock.now();
    const status = c.status === "open" && now.getTime() >= c.endsAt.getTime() ? "expired" : c.status;
    return {
      id: c.id,
      slug: c.slug,
      ownerName: c.ownerName,
      yours: viewer.accountId === c.ownerId,
      fullPrice: dollars(c.fullPrice),
      target: dollars(c.target),
      cuts: c.cuts,
      done: Math.min(cuts.length, c.cuts),
      price: dollars(priceAfter(c, cuts.length)),
      cutSize: dollars(cutSize(c)),
      endsAt: c.endsAt.toISOString(),
      status,
      holdsUntil: holdsUntil(c)?.toISOString() ?? null,
      cutters: cuts.map((x) => (x.cutter === c.ownerId ? `${c.ownerName} (started it)` : x.name)),
      youCut: viewer.cutter !== null && cuts.some((x) => x.cutter === viewer.cutter),
    };
  }

  return {
    /** Chops anyone can start now. */
    async offers(limit = 12): Promise<ChopOfferView[]> {
      return (await chops.offers({ startable: true, limit })).map((o) => offerView(o));
    },

    async sellerOffers(sellerId: string): Promise<ChopOfferView[]> {
      const list = await chops.offers({ sellerId, limit: 50 });
      const stats = await chops.stats(list.map((o) => o.id));
      return list.map((o) => offerView(o, stats.get(o.id) ?? { started: 0, done: 0 }));
    },

    async createOffer(sellerId: string, input: { slug: string; target: Cents; cuts: number; hours: number; stock: number }): Promise<Result<ChopOfferView, ChopError>> {
      const fullPrice = await products.livePrice(sellerId, input.slug);
      if (fullPrice === null) return err(domainError("invalid_offer", "Pick one of your live, priced listings."));
      const o = makeOffer({ id: newId(), sellerId, fullPrice, ...input, at: clock.now() });
      if (!o.ok) return o;
      await chops.saveOffer(o.value);
      return ok(offerView(o.value, { started: 0, done: 0 }));
    },

    async setOfferActive(sellerId: string, id: string, active: boolean): Promise<Result<ChopOfferView, ChopError>> {
      const o = await chops.offer(id);
      if (!o || o.sellerId !== sellerId) return err(domainError("not_found", "No such offer."));
      const next = { ...o, active };
      await chops.saveOffer(next);
      return ok(offerView(next));
    },

    /** Starts a chop (or returns the one already running) with the owner's own first cut. */
    async start(owner: { accountId: string; name: string }, offerId: string): Promise<Result<{ id: string }, ChopError>> {
      const offer = await chops.offer(offerId);
      if (!offer) return err(domainError("not_found", "No such chop."));
      const running = await chops.openFor(owner.accountId, offerId);
      if (running && running.endsAt.getTime() > clock.now().getTime()) return ok({ id: running.id });
      const chop = startChop(offer, { id: newCode(), owner, at: clock.now() });
      if (!chop.ok) return chop;
      return uow.run(async (s) => {
        if (!(await s.chops.reserve(offer.id))) return err(domainError("sold_out", "Every chop for this one has been taken."));
        if (!(await s.chops.create(chop.value))) throw new Error("Chop id taken");
        await s.chops.addCut({ chopId: chop.value.id, cutter: owner.accountId, name: owner.name, at: clock.now() });
        return ok({ id: chop.value.id });
      });
    },

    async view(id: string, viewer: { cutter: string | null; accountId: string | null }): Promise<ChopView | null> {
      const c = /^[a-z2-9]{8}$/.test(id) ? await chops.find(id) : null;
      return c ? view(c, viewer) : null;
    },

    /** A friend's cut. The last one finishes the chop and holds the target price for its owner. */
    async cut(id: string, cutter: { id: string; accountId: string | null; name: string }): Promise<Result<ChopView, ChopError>> {
      const now = clock.now();
      const outcome = await uow.run(async (s): Promise<Result<Chop, ChopError>> => {
        const c = await s.chops.lock(id);
        if (!c) return err(domainError("not_found", "No such chop."));
        const cuts = await s.chops.cuts(id);
        if (cuts.some((x) => x.cutter === cutter.id)) return err(domainError("already_cut", "You've already cut this one. Thanks!"));
        const problem = canCut(c, cutter, cuts.length, await s.chops.cutsSince(cutter.id, new Date(now.getTime() - DAY)), now);
        if (problem) return err(problem);
        await s.chops.addCut({ chopId: id, cutter: cutter.id, name: cutter.name, at: now });
        if (cuts.length + 1 >= c.cuts && (await s.chops.transition(id, "open", "done", now))) {
          const event: ChopCompleted = { type: "ChopCompleted", chopId: id, ownerId: c.ownerId, slug: c.slug, target: c.target, at: now };
          await s.events.record(id, event);
          return ok({ ...c, status: "done", doneAt: now });
        }
        return ok(c);
      });
      if (!outcome.ok) return outcome;
      return ok(await view(outcome.value, { cutter: cutter.id, accountId: cutter.accountId }));
    },

    /** The owner's chops, newest first. */
    async mine(accountId: string, limit = 10): Promise<ChopView[]> {
      return Promise.all((await chops.forOwner(accountId, limit)).map((c) => view(c, { cutter: accountId, accountId })));
    },

    /** Checkout: the chopped price this buyer holds for a product, one unit. */
    async bestHold(buyerId: string, slug: string): Promise<{ price: Cents; qty: number } | null> {
      const now = clock.now();
      const held = (await chops.done(buyerId, slug)).map((c) => heldPrice(c, now)).filter((p): p is Cents => p !== null);
      return held.length ? { price: money.cents(Math.min(...held)), qty: 1 } : null;
    },

    /** OrderPaid: chopped prices behind the order are used up. */
    async use(buyerId: string, slugs: readonly string[]) {
      for (const slug of slugs) for (const c of await chops.done(buyerId, slug)) await chops.transition(c.id, "done", "used");
    },

    /** Chops that ran out of time give their unit of stock back. */
    async expire(limit = 100): Promise<number> {
      let n = 0;
      for (const c of await chops.lapsed(clock.now(), limit)) {
        await uow.run(async (s) => {
          if (await s.chops.transition(c.id, "open", "expired")) {
            await s.chops.release(c.offerId);
            n++;
          }
        });
      }
      return n;
    },
  };
}

export type Chops = ReturnType<typeof makeChops>;
