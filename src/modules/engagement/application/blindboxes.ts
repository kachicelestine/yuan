import { domainError, err, ok, type Clock, type Result } from "@/shared/kernel";
import { holdBox, isFree, makeCase, odds, shakeHint, validSeries, type Box, type BoxError, type Case, type Figure, type Series } from "../domain/blindbox";
import type { BlindBoxRepository } from "../domain/repositories";

export type BlindBoxDeps = {
  boxes: BlindBoxRepository;
  clock: Clock;
  newId: () => string;
  random: () => number;
  /** Whether a live, priced listing belongs to the shop (the catalog knows). */
  listings?: { owns(sellerId: string, slug: string): Promise<boolean> };
};

/** A shop's series, with how it's selling. */
export type SellerSeriesView = { id: string; slug: string; title: string; poster: string; figures: Figure[]; secretOdds: number; shakesPerCase: number; active: boolean; cases: number; sold: number };

export type SeriesInput = { slug: string; title: string; figures: { name: string; image: string; secret: boolean }[]; secretOdds: number; shakesPerCase: number };

export type BoxSlot = "free" | "taken" | "held" | "mine";

/** The box machine as one shopper sees it. What's inside a box is never in here until it's theirs and opened. */
export type MachineView = {
  series: { id: string; slug: string; title: string; poster: string; figures: { id: string; name: string; image: string; secret: boolean }[]; odds: { regular: number; secret: number }; shakesPerCase: number };
  case: { id: string; number: number; size: number; slots: BoxSlot[]; left: number; shakesLeft: number };
  /** Figures each box doesn't hold, from this shopper's shakes. */
  hints: Record<number, string[]>;
  /** Boxes this shopper bought from the series; the figure shows once opened. */
  owned: { caseId: string; caseNumber: number; index: number; figureId: string | null }[];
};

export type OrderBox = { orderId: string; seriesTitle: string; caseNumber: number; index: number; figure: { name: string; image: string; secret: boolean } };

export function makeBlindBoxes({ boxes, clock, newId, random, listings }: BlindBoxDeps) {
  /** The case to sell from: the newest one with a free box, or a fresh one. */
  async function currentCase(s: Series): Promise<{ c: Case; taken: Box[] }> {
    const now = clock.now();
    for (let attempt = 0; attempt < 3; attempt++) {
      const latest = await boxes.latestCase(s.id);
      if (latest) {
        const taken = await boxes.boxes([latest.id]);
        if (latest.boxes.some((_, i) => isFree(taken.find((b) => b.index === i), now))) return { c: latest, taken };
      }
      const next = makeCase(s, newId(), (latest?.number ?? 0) + 1, random, now);
      // Two shoppers can race to open the next case; the loser reads the winner's.
      if (await boxes.createCase(next)) return { c: next, taken: [] };
    }
    throw new Error(`couldn't open a case for ${s.id}`);
  }

  async function view(s: Series, viewer: string | null, picked?: { c: Case; taken: Box[] }): Promise<MachineView> {
    const now = clock.now();
    const { c, taken } = picked ?? (await currentCase(s));
    const hints = viewer ? await boxes.hints(c.id, viewer) : [];
    const owned = viewer ? await boxes.owned(viewer, s.id) : [];
    const cases = new Map<string, Case>([[c.id, c]]);
    for (const b of owned) if (!cases.has(b.caseId)) cases.set(b.caseId, (await boxes.findCase(b.caseId))!);
    const slots = c.boxes.map((_, i): BoxSlot => {
      const b = taken.find((x) => x.index === i);
      if (isFree(b, now)) return "free";
      if (b!.buyerId === viewer) return b!.state === "sold" ? "mine" : "held";
      return "taken";
    });
    return {
      series: { id: s.id, slug: s.slug, title: s.title, poster: s.poster, figures: s.figures.map((f) => ({ ...f })), odds: odds(s), shakesPerCase: s.shakesPerCase },
      case: { id: c.id, number: c.number, size: c.boxes.length, slots, left: slots.filter((x) => x === "free").length, shakesLeft: Math.max(0, s.shakesPerCase - hints.length) },
      hints: hints.reduce<Record<number, string[]>>((m, h) => ({ ...m, [h.index]: [...(m[h.index] ?? []), h.figureId] }), {}),
      owned: owned.map((b) => ({ caseId: b.caseId, caseNumber: cases.get(b.caseId)?.number ?? 0, index: b.index, figureId: b.openedAt ? (cases.get(b.caseId)?.boxes[b.index] ?? null) : null })),
    };
  }

  async function caseOf(caseId: string, seriesId?: string) {
    const c = await boxes.findCase(caseId);
    const s = c ? await boxes.series(c.seriesId) : null;
    return c && s && s.active && (!seriesId || s.id === seriesId) ? { c, s } : null;
  }

  async function sellerView(s: Series): Promise<SellerSeriesView> {
    return { id: s.id, slug: s.slug, title: s.title, poster: s.poster, figures: [...s.figures], secretOdds: s.secretOdds, shakesPerCase: s.shakesPerCase, active: s.active, ...(await boxes.seriesStats(s.id)) };
  }

  return {
    /** A shop starts selling a listing as blind boxes. One live series per listing. */
    async createSeries(sellerId: string, input: SeriesInput): Promise<Result<SellerSeriesView, BoxError>> {
      if (!listings || !(await listings.owns(sellerId, input.slug))) return err(domainError("invalid_series", "Pick one of your live, priced listings."));
      if (await boxes.seriesFor(input.slug)) return err(domainError("invalid_series", "That listing already has a live series. Pause it first."));
      const title = input.title.trim();
      if (title.length < 2 || title.length > 60) return err(domainError("invalid_series", "Name the series (up to 60 characters)."));
      const figures: Figure[] = input.figures.map((f, i) => ({ id: `f${i + 1}`, name: f.name.trim().slice(0, 40), image: f.image, secret: f.secret }));
      if (figures.some((f) => f.name.length < 1 || !f.image)) return err(domainError("invalid_series", "Each figure needs a name and a photo."));
      const s: Series = { id: newId(), sellerId, slug: input.slug, title, poster: figures[0]?.image ?? "", figures, secretOdds: figures.some((f) => f.secret) ? input.secretOdds : figures.length, shakesPerCase: input.shakesPerCase, active: true, createdAt: clock.now() };
      const valid = validSeries(s);
      if (!valid.ok) return valid;
      await boxes.saveSeries(s);
      return ok(await sellerView(s));
    },

    async sellerSeries(sellerId: string): Promise<SellerSeriesView[]> {
      return Promise.all((await boxes.sellerSeries(sellerId)).map(sellerView));
    },

    /** Pauses or resumes a series. Boxes already sold still ship. */
    async setActive(sellerId: string, seriesId: string, active: boolean): Promise<Result<SellerSeriesView, BoxError>> {
      const s = await boxes.series(seriesId);
      if (!s || s.sellerId !== sellerId) return err(domainError("not_found", "No such series."));
      if (active && !s.active && (await boxes.seriesFor(s.slug))) return err(domainError("invalid_series", "That listing already has a live series."));
      const next = { ...s, active };
      await boxes.saveSeries(next);
      return ok(await sellerView(next));
    },

    series: () => boxes.activeSeries(),
    seriesFor: (slug: string) => boxes.seriesFor(slug),

    async machine(seriesId: string, viewer: string | null): Promise<MachineView | null> {
      const s = await boxes.series(seriesId);
      return s && s.active ? view(s, viewer) : null;
    },

    /** Holds a box for the shopper while they check out. */
    async pick(buyerId: string, caseId: string, index: number): Promise<Result<{ view: MachineView; slug: string; caseNumber: number }, BoxError>> {
      const found = await caseOf(caseId);
      if (!found) return err(domainError("not_found", "That case is gone. Pick from the new one."));
      const now = clock.now();
      const taken = await boxes.boxes([caseId]);
      const held = holdBox({ caseId, index, size: found.c.boxes.length, current: taken.find((b) => b.index === index), buyerId, heldByBuyer: (await boxes.heldBy(buyerId, now)).length, at: now });
      if (!held.ok) return held;
      if (!(await boxes.hold(held.value, now))) return err(domainError("taken", "Someone else just took that box. Pick another."));
      return ok({ view: await view(found.s, buyerId, { c: found.c, taken: await boxes.boxes([caseId]) }), slug: found.s.slug, caseNumber: found.c.number });
    },

    async release(buyerId: string, caseId: string, index: number) {
      await boxes.release(caseId, index, buyerId);
    },

    /** Rules out one figure the box doesn't hold, if the shopper has shakes left in this case. */
    async shake(buyerId: string, caseId: string, index: number): Promise<Result<{ figureId: string | null; view: MachineView }, BoxError>> {
      const found = await caseOf(caseId);
      if (!found || !Number.isInteger(index) || index < 0 || index >= found.c.boxes.length) return err(domainError("not_found", "No such box."));
      const now = clock.now();
      const taken = await boxes.boxes([caseId]);
      const box = taken.find((b) => b.index === index);
      if (!isFree(box, now) && box!.buyerId !== buyerId) return err(domainError("taken", "Someone else has that box."));
      const used = await boxes.hints(caseId, buyerId);
      if (used.length >= found.s.shakesPerCase) return err(domainError("no_shakes", "No shakes left for this case."));
      const figureId = shakeHint(found.s, found.c.boxes[index], used.filter((h) => h.index === index).map((h) => h.figureId), random);
      if (figureId) await boxes.addHint(caseId, index, buyerId, figureId, now);
      return ok({ figureId, view: await view(found.s, buyerId, { c: found.c, taken }) });
    },

    /**
     * A paid order: the buyer's held boxes of each series in it become theirs, and any more
     * they paid for are taken from the case at random. Safe to run twice for one order.
     */
    async paid(buyerId: string, orderId: string, lines: readonly { slug: string; qty: number }[]) {
      if ((await boxes.soldTo(orderId)).length) return 0;
      const now = clock.now();
      let sold = 0;
      for (const line of lines) {
        const s = await boxes.seriesFor(line.slug);
        if (!s) continue;
        let need = line.qty;
        for (const b of (await boxes.heldBy(buyerId, now)).sort((a, z) => a.at.getTime() - z.at.getTime())) {
          if (need === 0) break;
          if ((await boxes.findCase(b.caseId))?.seriesId !== s.id) continue;
          if (await boxes.sell(b.caseId, b.index, buyerId, orderId, now)) {
            need--;
            sold++;
          }
        }
        for (let guard = 0; need > 0 && guard < 200; guard++) {
          const { c, taken } = await currentCase(s);
          const free = c.boxes.map((_, i) => i).filter((i) => isFree(taken.find((b) => b.index === i), now));
          const i = free[Math.floor(random() * free.length)];
          if (await boxes.sell(c.id, i, buyerId, orderId, now)) {
            need--;
            sold++;
          }
        }
      }
      return sold;
    },

    /** Opens one of the shopper's boxes and shows what's inside. */
    async open(buyerId: string, caseId: string, index: number): Promise<Result<{ figureId: string }, BoxError>> {
      const found = await caseOf(caseId);
      if (!found) return err(domainError("not_found", "No such box."));
      if (!(await boxes.markOpened(caseId, index, buyerId, clock.now()))) return err(domainError("not_yours", "Only a box you bought can be opened."));
      return ok({ figureId: found.c.boxes[index] });
    },

    /** Which figure each paid box holds, for the shop to send. */
    async forOrders(orderIds: readonly string[]): Promise<OrderBox[]> {
      const sold = await boxes.forOrders(orderIds);
      const out: OrderBox[] = [];
      for (const b of sold) {
        const c = await boxes.findCase(b.caseId);
        const s = c ? await boxes.series(c.seriesId) : null;
        const f = c && s?.figures.find((x) => x.id === c.boxes[b.index]);
        if (c && s && f && b.orderId) out.push({ orderId: b.orderId, seriesTitle: s.title, caseNumber: c.number, index: b.index, figure: { name: f.name, image: f.image, secret: f.secret } });
      }
      return out;
    },

    sweep: () => boxes.sweep(clock.now()),
  };
}

export type BlindBoxes = ReturnType<typeof makeBlindBoxes>;
