import { domainError, err, ok, type Clock, type EventLog, type Result } from "@/shared/kernel";
import {
  declineSample,
  lapsesAt,
  markPosted,
  offerSamples,
  POST_WINDOW_DAYS,
  requestSample,
  shipSample,
  type SampleError,
  type SampleEvent,
  type SampleOffer,
  type SampleRequest,
  type ShippingAddress,
} from "../domain/sample";
import type { SampleRepository } from "../domain/repositories";
import type { ShopMembers } from "./affiliates";

export type SampleScope = { samples: SampleRepository; events: EventLog };

export type SamplesDeps = {
  samples: SampleRepository;
  members: ShopMembers;
  /** Whether the shop sells this listing and it's live (catalog owns listings). */
  products: { live(sellerId: string, slug: string): Promise<boolean> };
  uow: { run<T>(work: (scope: SampleScope) => Promise<T>): Promise<T> };
  clock: Clock;
  newId: () => string;
};

export type SampleOfferView = { id: string; sellerId: string; slug: string; remaining: number; active: boolean };

export type SampleRequestView = {
  id: string;
  slug: string;
  sellerId: string;
  status: SampleRequest["status"];
  creatorName: string;
  note: string;
  carrier: string | null;
  tracking: string | null;
  reason: string | null;
  requestedAt: string;
  shippedAt: string | null;
  /** Shipped samples: when it lapses if no video is posted. */
  lapsesAt: string | null;
  /** Only the shop sees where to send it. */
  address?: ShippingAddress;
};

const offerView = (o: SampleOffer): SampleOfferView => ({ id: o.id, sellerId: o.sellerId, slug: o.slug, remaining: o.remaining, active: o.active });
const requestView = (r: SampleRequest, withAddress: boolean): SampleRequestView => ({
  id: r.id,
  slug: r.slug,
  sellerId: r.sellerId,
  status: r.status,
  creatorName: r.creatorName,
  note: r.note,
  carrier: r.carrier,
  tracking: r.tracking,
  reason: r.reason,
  requestedAt: r.requestedAt.toISOString(),
  shippedAt: r.shippedAt?.toISOString() ?? null,
  lapsesAt: r.status === "shipped" ? (lapsesAt(r)?.toISOString() ?? null) : null,
  ...(withAddress ? { address: r.address } : {}),
});

export function makeSamples({ samples, members, products, uow, clock, newId }: SamplesDeps) {
  const event = (type: SampleEvent["type"], r: SampleRequest): SampleEvent => ({ type, requestId: r.id, sellerId: r.sellerId, creatorId: r.creatorId, slug: r.slug, at: clock.now() });

  async function answer(sellerId: string, id: string, change: (r: SampleRequest) => Result<SampleRequest, SampleError>, type: SampleEvent["type"], giveBack: boolean): Promise<Result<SampleRequestView, SampleError>> {
    const r = await samples.request(id);
    if (!r || r.sellerId !== sellerId) return err(domainError("not_found", "No such request."));
    const next = change(r);
    if (!next.ok) return next;
    await uow.run(async (s) => {
      await s.samples.saveRequest(next.value);
      if (giveBack) await s.samples.give(r.offerId);
      await s.events.record(r.id, event(type, next.value));
    });
    return ok(requestView(next.value, true));
  }

  return {
    /** Samples creators can ask for now. */
    async offers(limit = 12): Promise<SampleOfferView[]> {
      return (await samples.offers({ available: true, limit })).map(offerView);
    },

    async sellerOffers(sellerId: string): Promise<SampleOfferView[]> {
      return (await samples.offers({ sellerId, limit: 50 })).map(offerView);
    },

    async createOffer(sellerId: string, slug: string, quantity: number): Promise<Result<SampleOfferView, SampleError>> {
      if (!(await products.live(sellerId, slug))) return err(domainError("invalid_offer", "Pick one of your live listings."));
      const o = offerSamples({ id: newId(), sellerId, slug, quantity, at: clock.now() });
      if (!o.ok) return o;
      await samples.saveOffer(o.value);
      return ok(offerView(o.value));
    },

    async setOfferActive(sellerId: string, id: string, active: boolean): Promise<Result<SampleOfferView, SampleError>> {
      const o = await samples.offer(id);
      if (!o || o.sellerId !== sellerId) return err(domainError("not_found", "No such offer."));
      await samples.saveOffer({ ...o, active });
      return ok(offerView({ ...o, active }));
    },

    async request(creator: { accountId: string; name: string }, offerId: string, address: ShippingAddress, note: string): Promise<Result<SampleRequestView, SampleError>> {
      const offer = await samples.offer(offerId);
      if (!offer) return err(domainError("not_found", "No such sample."));
      const r = requestSample(offer, {
        id: newId(),
        creator,
        address,
        note,
        runsShop: await members.runsShop(creator.accountId, offer.sellerId),
        history: await samples.forCreator(creator.accountId),
        at: clock.now(),
      });
      if (!r.ok) return r;
      return uow.run(async (s) => {
        if (!(await s.samples.take(offer.id))) return err(domainError("unavailable", "These samples have all been claimed."));
        await s.samples.saveRequest(r.value);
        await s.events.record(r.value.id, event("SampleRequested", r.value));
        return ok(requestView(r.value, false));
      });
    },

    ship: (sellerId: string, id: string, input: { carrier: string; tracking: string }) => answer(sellerId, id, (r) => shipSample(r, input, clock.now()), "SampleShipped", false),

    decline: (sellerId: string, id: string, reason: string) => answer(sellerId, id, (r) => declineSample(r, reason, clock.now()), "SampleDeclined", true),

    /** VideoPublished: a creator's video featuring a sample they were sent closes the deal. */
    async videoPosted(e: { authorId: string; productSlug: string; videoId: string }): Promise<number> {
      let n = 0;
      for (const r of await samples.shippedFor(e.authorId, e.productSlug)) {
        const posted = markPosted(r, e.videoId, clock.now());
        if (!posted) continue;
        await uow.run(async (s) => {
          await s.samples.saveRequest(posted);
          await s.events.record(r.id, event("SamplePosted", posted));
        });
        n++;
      }
      return n;
    },

    /** Shipped samples with no video after the window lapse. */
    async lapse(limit = 200): Promise<number> {
      const now = clock.now();
      const overdue = await samples.overdue(new Date(now.getTime() - POST_WINDOW_DAYS * 86_400_000), limit);
      for (const r of overdue) await samples.saveRequest({ ...r, status: "lapsed", closedAt: now });
      return overdue.length;
    },

    async mine(creatorId: string): Promise<SampleRequestView[]> {
      return (await samples.forCreator(creatorId)).map((r) => requestView(r, false));
    },

    async sellerRequests(sellerId: string): Promise<SampleRequestView[]> {
      return (await samples.forSeller(sellerId, 100)).map((r) => requestView(r, true));
    },
  };
}

export type Samples = ReturnType<typeof makeSamples>;
