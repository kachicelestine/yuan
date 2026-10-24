import { domainError, err, ok, type Cents, type Clock, type DomainError, type EventLog, type Result } from "@/shared/kernel";
import { closeLot, minimumBid, openLot, placeBid, type Lot, type LotError } from "../domain/auction";
import { writeMessage, type ChatError, type ChatMessage } from "../domain/chat";
import { holdHammerPrice, holdLivePrice, type HoldError, type PriceHold } from "../domain/hold";
import type { ChatRepository, HoldRepository, LiveBus, LotRepository, ShowRepository } from "../domain/repositories";
import { endShow, goLive, livePriceOf, pin, pinQuestion, scheduleShow, type Show, type ShowError, type ShowKind } from "../domain/show";

/** What live needs from the catalog: which products a shop may put on air. */
export interface LiveCatalog {
  /** The slugs among these that the shop sells and are listed. */
  owned(sellerId: string, slugs: readonly string[]): Promise<string[]>;
}

/** Where broadcasters send video and viewers fetch it (a media server); null without one. */
export type MediaUrls = Readonly<{ ingest: string; playback: string }> | null;

export type LiveScope = { shows: ShowRepository; lots: LotRepository; holds: HoldRepository; events: EventLog };

export type LiveDeps = {
  shows: ShowRepository;
  chat: ChatRepository;
  lots: LotRepository;
  holds: HoldRepository;
  bus: LiveBus;
  catalog: LiveCatalog;
  media: MediaUrls;
  uow: { run<T>(work: (scope: LiveScope) => Promise<T>): Promise<T> };
  clock: Clock;
  newId: () => string;
  newKey: () => string;
};

export type LiveError = ShowError | LotError | ChatError | HoldError | DomainError<"not_found" | "forbidden" | "busy">;

export type ShowView = {
  id: string;
  sellerId: string;
  hostName: string;
  title: string;
  kind: ShowKind;
  coverUrl: string;
  place: string;
  status: Show["status"];
  scheduledFor: string;
  startedAt: string | null;
  items: { slug: string; livePrice: number | null; status: Show["items"][number]["status"] }[];
  pinned: { q: string; a: string } | null;
  peakViewers: number;
  /** HLS playlist while the show is live and a media server is set up. */
  playbackUrl: string | null;
};

/** What the host's studio needs on top: where to send video, with the key. */
export type StudioView = ShowView & { ingestUrl: string | null };

export type MessageView = { id: string; name: string; text: string; host: boolean; at: string };

export type LotView = {
  id: string;
  slug: string;
  startPrice: number;
  increment: number;
  endsAt: string;
  status: Lot["status"];
  topBid: { amount: number; name: string } | null;
  minimumBid: number;
  bids: number;
};

const dollars = (c: Cents) => c / 100;
const path = (showId: string) => `show-${showId}`;

/** Bidders appear as "kofi_a***": recognisable to themselves, not to everyone. */
const mask = (name: string) => (name.length <= 3 ? `${name}***` : `${name.slice(0, Math.min(6, name.length - 2))}***`);

export const toMessageView = (m: ChatMessage): MessageView => ({ id: m.id, name: m.authorName, text: m.text, host: m.host, at: m.at.toISOString() });

export const toLotView = (l: Lot): LotView => ({
  id: l.id,
  slug: l.slug,
  startPrice: dollars(l.startPrice),
  increment: dollars(l.increment),
  endsAt: l.endsAt.toISOString(),
  status: l.status,
  topBid: l.topBid && { amount: dollars(l.topBid.amount), name: mask(l.topBid.bidderName) },
  minimumBid: dollars(minimumBid(l)),
  bids: l.bids,
});

export function makeLive({ shows, chat, lots, holds, bus, catalog, media, uow, clock, newId, newKey }: LiveDeps) {
  const view = (s: Show): ShowView => ({
    id: s.id,
    sellerId: s.sellerId,
    hostName: s.hostName,
    title: s.title,
    kind: s.kind,
    coverUrl: s.coverUrl,
    place: s.place,
    status: s.status,
    scheduledFor: s.scheduledFor.toISOString(),
    startedAt: s.startedAt?.toISOString() ?? null,
    items: s.items.map((i) => ({ slug: i.slug, livePrice: i.livePrice === null ? null : dollars(i.livePrice), status: i.status })),
    pinned: s.pinned,
    peakViewers: s.peakViewers,
    playbackUrl: s.status === "live" && media ? `${media.playback}/${path(s.id)}/index.m3u8` : null,
  });

  /** The show, if this shop runs it. */
  async function own(sellerId: string, showId: string) {
    const s = await shows.find(showId);
    return s && s.sellerId === sellerId ? s : null;
  }

  async function saveAndTell(s: Show, signal: { type: string; [k: string]: unknown }, event?: { type: string; at: Date } | null) {
    await uow.run(async (scope) => {
      await scope.shows.save(s);
      if (event) await scope.events.record(s.id, event);
    });
    await bus.publish(s.id, signal);
  }

  /** Closes a due lot (once), gives the winner a hold at the hammer price, and tells the room. */
  async function settle(lot: Lot): Promise<Lot> {
    const { lot: closed, event } = closeLot(lot, clock.now());
    if (closed === lot) return lot;
    const done = await uow.run(async (s) => {
      if (!(await s.lots.update(closed))) return false;
      if (event) {
        await s.holds.add(holdHammerPrice({ id: newId(), accountId: event.winnerId, slug: event.slug, price: event.amount, lotId: event.lotId, at: event.at }));
        await s.events.record(lot.id, event);
      }
      return true;
    });
    if (!done) return (await lots.find(lot.id)) ?? lot;
    await bus.publish(lot.showId, { type: "lot", lot: toLotView(closed) });
    return closed;
  }

  return {
    async lobby(): Promise<{ live: ShowView[]; upcoming: ShowView[]; replays: ShowView[] }> {
      const [live, upcoming, replays] = await Promise.all([shows.list("live", 20), shows.list("scheduled", 20), shows.list("ended", 12)]);
      return { live: live.map(view), upcoming: upcoming.map(view), replays: replays.map(view) };
    },

    async show(id: string): Promise<{ show: ShowView; messages: MessageView[]; lots: LotView[] } | null> {
      const s = await shows.find(id);
      if (!s) return null;
      const [messages, all] = await Promise.all([chat.recent(id, 50), lots.forShow(id)]);
      const settled = await Promise.all(all.map((l) => (l.status === "open" && l.endsAt.getTime() <= clock.now().getTime() ? settle(l) : l)));
      return { show: view(s), messages: messages.map(toMessageView), lots: settled.map(toLotView) };
    },

    async forSeller(sellerId: string): Promise<ShowView[]> {
      return (await shows.forSeller(sellerId, 30)).map(view);
    },

    async schedule(
      host: { accountId: string; name: string; sellerId: string },
      input: { title: string; kind: ShowKind; coverUrl: string; place: string; scheduledFor: Date; items: readonly { slug: string; livePrice: Cents | null }[] },
    ): Promise<Result<ShowView, LiveError>> {
      const allowed = new Set(await catalog.owned(host.sellerId, input.items.map((i) => i.slug)));
      const made = scheduleShow({
        id: newId(),
        sellerId: host.sellerId,
        hostAccountId: host.accountId,
        hostName: host.name,
        title: input.title,
        kind: input.kind,
        coverUrl: input.coverUrl,
        place: input.place,
        scheduledFor: input.scheduledFor,
        streamKey: newKey(),
        items: input.items.filter((i) => allowed.has(i.slug)),
      });
      if (!made.ok) return made;
      await shows.save(made.value);
      return ok(view(made.value));
    },

    async studio(sellerId: string, showId: string): Promise<StudioView | null> {
      const s = await own(sellerId, showId);
      if (!s) return null;
      return { ...view(s), ingestUrl: media ? `${media.ingest}/${path(s.id)}/whip?key=${encodeURIComponent(s.streamKey)}` : null };
    },

    async start(sellerId: string, showId: string): Promise<Result<ShowView, LiveError>> {
      const s = await own(sellerId, showId);
      if (!s) return err(domainError("not_found", "No such show."));
      const r = goLive(s, clock.now());
      if (!r.ok) return r;
      await saveAndTell(r.value.show, { type: "show", show: view(r.value.show) }, r.value.event);
      return ok(view(r.value.show));
    },

    async end(sellerId: string, showId: string): Promise<Result<ShowView, LiveError>> {
      const s = await own(sellerId, showId);
      if (!s) return err(domainError("not_found", "No such show."));
      const r = endShow(s, clock.now());
      if (!r.ok) return r;
      await saveAndTell(r.value.show, { type: "show", show: view(r.value.show) }, r.value.event);
      return ok(view(r.value.show));
    },

    async pinItem(sellerId: string, showId: string, slug: string): Promise<Result<ShowView, LiveError>> {
      const s = await own(sellerId, showId);
      if (!s) return err(domainError("not_found", "No such show."));
      const r = pin(s, slug);
      if (!r.ok) return r;
      await saveAndTell(r.value, { type: "show", show: view(r.value) });
      return ok(view(r.value));
    },

    async pinQuestion(sellerId: string, showId: string, q: string, a: string): Promise<Result<ShowView, LiveError>> {
      const s = await own(sellerId, showId);
      if (!s) return err(domainError("not_found", "No such show."));
      const r = pinQuestion(s, q, a);
      if (!r.ok) return r;
      await saveAndTell(r.value, { type: "show", show: view(r.value) });
      return ok(view(r.value));
    },

    /** A chat message. `hostOf` says which shops the author runs, so the host is marked. */
    async say(author: { accountId: string; name: string; shops: readonly string[] }, showId: string, text: string): Promise<Result<MessageView, LiveError>> {
      const s = await shows.find(showId);
      if (!s || s.status === "ended") return err(domainError("not_found", "This show isn't on."));
      const m = writeMessage({ id: newId(), showId, authorId: author.accountId, authorName: author.shops.includes(s.sellerId) ? s.hostName : author.name, text, host: author.shops.includes(s.sellerId), at: clock.now() });
      if (!m.ok) return m;
      await chat.add(m.value);
      const v = toMessageView(m.value);
      await bus.publish(showId, { type: "message", message: v });
      return ok(v);
    },

    /** Hearts are a feeling, not data: broadcast, never stored. */
    async heart(showId: string): Promise<void> {
      await bus.publish(showId, { type: "heart" });
    },

    /** Lock the live price for this viewer, so they can check out after the show moves on. */
    async holdPrice(accountId: string, showId: string, slug: string): Promise<Result<{ price: number; expiresAt: string }, LiveError>> {
      const s = await shows.find(showId);
      if (!s) return err(domainError("not_found", "This show isn't on."));
      const h = holdLivePrice({ id: newId(), accountId, slug, price: livePriceOf(s, slug), showId, at: clock.now() });
      if (!h.ok) return h;
      await holds.add(h.value);
      return ok({ price: dollars(h.value.price), expiresAt: h.value.expiresAt.toISOString() });
    },

    async addLot(sellerId: string, showId: string, input: { slug: string; startPrice: Cents; increment: Cents; durationMs: number }): Promise<Result<LotView, LiveError>> {
      const s = await own(sellerId, showId);
      if (!s) return err(domainError("not_found", "No such show."));
      if (s.status !== "live" || s.kind !== "auction") return err(domainError("not_live", "Lots open during a live auction."));
      if (!s.items.some((i) => i.slug === input.slug)) return err(domainError("unknown_item", "Add the product to the show first."));
      const lot = openLot({ id: newId(), showId, ...input, at: clock.now() });
      if (!lot.ok) return lot;
      await lots.insert(lot.value);
      await bus.publish(showId, { type: "lot", lot: toLotView(lot.value) });
      return ok(toLotView(lot.value));
    },

    /** A bid. Concurrent bids race on the lot's version; the loser retries against the new top bid. */
    async bid(bidder: { accountId: string; name: string }, lotId: string, amount: Cents): Promise<Result<LotView, LiveError>> {
      for (let attempt = 0; attempt < 3; attempt++) {
        const lot = await lots.find(lotId);
        if (!lot) return err(domainError("not_found", "No such lot."));
        const r = placeBid(lot, { id: bidder.accountId, name: bidder.name }, amount, clock.now());
        if (!r.ok) {
          if (r.error.code === "lot_closed") await settle(lot);
          return r;
        }
        if (await lots.update(r.value)) {
          const v = toLotView(r.value);
          await bus.publish(lot.showId, { type: "lot", lot: v });
          return ok(v);
        }
      }
      return err(domainError("busy", "Lots of bids at once. Try again."));
    },

    async lot(lotId: string): Promise<LotView | null> {
      const l = await lots.find(lotId);
      return l && toLotView(l.status === "open" && l.endsAt.getTime() <= clock.now().getTime() ? await settle(l) : l);
    },

    /** Background job: close lots whose clock ran out. */
    async closeDueLots(): Promise<number> {
      const due = await lots.due(clock.now(), 50);
      for (const l of due) await settle(l);
      return due.length;
    },

    /** Checkout asks: does this buyer hold a better price on this product? */
    bestHold: (accountId: string, slug: string): Promise<PriceHold | null> => holds.best(accountId, slug, clock.now()),

    /** OrderPaid: the holds behind the order's prices are used up. */
    useHolds: (accountId: string, slugs: readonly string[]) => holds.use(accountId, slugs, clock.now()),

    notePeak: (showId: string, viewers: number) => shows.notePeak(showId, viewers),

    /** Who may publish video to a media path: the stream key must match a show that isn't over. */
    async mayPublish(mediaPath: string, key: string): Promise<boolean> {
      const id = mediaPath.startsWith("show-") ? mediaPath.slice("show-".length) : null;
      const s = id ? await shows.find(id) : null;
      return !!s && s.status !== "ended" && s.streamKey.length > 0 && s.streamKey === key;
    },

    /** Anyone may watch a show that's on. */
    async mayRead(mediaPath: string): Promise<boolean> {
      const id = mediaPath.startsWith("show-") ? mediaPath.slice("show-".length) : null;
      const s = id ? await shows.find(id) : null;
      return s?.status === "live";
    },
  };
}

export type Live = ReturnType<typeof makeLive>;
