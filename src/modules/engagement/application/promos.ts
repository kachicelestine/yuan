import { domainError, err, money, ok, type Cents, type Clock, type EventLog, type Result } from "@/shared/kernel";
import {
  canClaim,
  canJoin,
  DROP_HOLD_MS,
  dropState,
  makeTeamOffer,
  REMIND_BEFORE_MS,
  scheduleDrop,
  startTeam,
  TEAM_HOLD_MS,
  type Drop,
  type DropError,
  type DropKind,
  type DropState,
  type Team,
  type TeamError,
  type TeamFilled,
  type TeamOffer,
} from "../domain/drop";
import type { DropRepository, PromoHoldRepository, Reminder, ReminderRepository, TeamRepository } from "../domain/repositories";
import type { ChopProducts } from "./chops";

export type PromoScope = { drops: DropRepository; holds: PromoHoldRepository; teams: TeamRepository; events: EventLog };

export type PromosDeps = {
  drops: DropRepository;
  holds: PromoHoldRepository;
  teams: TeamRepository;
  reminders: ReminderRepository;
  products: ChopProducts;
  uow: { run<T>(work: (scope: PromoScope) => Promise<T>): Promise<T> };
  clock: Clock;
  newId: () => string;
  newCode: () => string;
};

export type DropView = {
  id: string;
  sellerId: string;
  slug: string;
  kind: DropKind;
  title: string;
  blurb: string;
  startsAt: string;
  endsAt: string;
  price: number | null;
  stock: number | null;
  claimed: number;
  perPerson: number;
  state: DropState;
  waiting: number;
  reminded: boolean;
  cancelled: boolean;
};

export type TeamOfferView = { id: string; sellerId: string; slug: string; fullPrice: number; teamPrice: number; size: number; hours: number; remaining: number; active: boolean; started?: number; full?: number };

export type TeamView = {
  id: string;
  offerId: string;
  slug: string;
  leaderName: string;
  teamPrice: number;
  size: number;
  endsAt: string;
  status: "open" | "full" | "expired";
  members: string[];
  youAreIn: boolean;
  holdsUntil: string | null;
};

const dollars = (c: number) => c / 100;
const dropKey = (id: string) => `drop:${id}`;

const offerView = (o: TeamOffer, s?: { started: number; full: number }): TeamOfferView => ({
  id: o.id,
  sellerId: o.sellerId,
  slug: o.slug,
  fullPrice: dollars(o.fullPrice),
  teamPrice: dollars(o.teamPrice),
  size: o.size,
  hours: o.hours,
  remaining: o.remaining,
  active: o.active,
  ...(s ? { started: s.started, full: s.full } : {}),
});

export function makePromos(deps: PromosDeps) {
  const { drops, holds, teams, reminders, products, uow, clock, newId, newCode } = deps;

  async function dropViews(list: readonly Drop[], accountId: string | null): Promise<DropView[]> {
    const keys = list.map((d) => dropKey(d.id));
    const [counts, mine] = await Promise.all([reminders.counts(keys), accountId ? reminders.mine(accountId, keys) : Promise.resolve(new Set<string>())]);
    const now = clock.now();
    return list.map((d) => ({
      id: d.id,
      sellerId: d.sellerId,
      slug: d.slug,
      kind: d.kind,
      title: d.title,
      blurb: d.blurb,
      startsAt: d.startsAt.toISOString(),
      endsAt: d.endsAt.toISOString(),
      price: d.price === null ? null : dollars(d.price),
      stock: d.stock,
      claimed: d.claimed,
      perPerson: d.perPerson,
      state: dropState(d, now),
      waiting: counts.get(dropKey(d.id)) ?? 0,
      reminded: mine.has(dropKey(d.id)),
      cancelled: d.cancelled,
    }));
  }

  async function teamView(t: Team, accountId: string | null): Promise<TeamView> {
    const members = await teams.members(t.id);
    const now = clock.now();
    const status = t.status === "open" && now.getTime() >= t.endsAt.getTime() ? "expired" : t.status;
    return {
      id: t.id,
      offerId: t.offerId,
      slug: t.slug,
      leaderName: t.leaderName,
      teamPrice: dollars(t.teamPrice),
      size: t.size,
      endsAt: t.endsAt.toISOString(),
      status,
      members: members.map((m) => m.name),
      youAreIn: accountId !== null && members.some((m) => m.accountId === accountId),
      holdsUntil: t.fullAt ? new Date(t.fullAt.getTime() + TEAM_HOLD_MS).toISOString() : null,
    };
  }

  /** Adds the person to the team; the one who fills it unlocks the team price for everyone. */
  async function join(team: Team, member: { accountId: string; name: string }, s: PromoScope): Promise<Result<Team, TeamError>> {
    const now = clock.now();
    const current = await s.teams.members(team.id);
    const problem = canJoin(team, member.accountId, current, now);
    if (problem) return err(problem);
    await s.teams.addMember({ teamId: team.id, accountId: member.accountId, name: member.name, at: now });
    if (current.length + 1 < team.size || !(await s.teams.transition(team.id, "open", "full", now))) return ok(team);
    const everyone = [...current.map((m) => m.accountId), member.accountId];
    for (const accountId of everyone) {
      await s.holds.add({ id: newId(), accountId, slug: team.slug, price: team.teamPrice, qty: 1, source: "team", sourceId: team.id, expiresAt: new Date(now.getTime() + TEAM_HOLD_MS), usedAt: null });
    }
    const event: TeamFilled = { type: "TeamFilled", teamId: team.id, members: everyone, slug: team.slug, teamPrice: team.teamPrice, at: now };
    await s.events.record(team.id, event);
    return ok({ ...team, status: "full", fullAt: now });
  }

  return {
    // ── Drops ──────────────────────────────────────────────────────────────
    /** Drops not over yet (live first, then by start), as this person sees them. */
    async drops(accountId: string | null, limit = 40): Promise<DropView[]> {
      return dropViews(await drops.list({ from: clock.now(), limit }), accountId);
    },

    async sellerDrops(sellerId: string): Promise<DropView[]> {
      return dropViews(await drops.list({ sellerId, limit: 50 }), null);
    },

    async scheduleDrop(sellerId: string, input: { slug: string; kind: DropKind; title: string; blurb: string; startsAt: Date; price: Cents | null; stock: number | null; perPerson: number }): Promise<Result<DropView, DropError>> {
      const normalPrice = await products.livePrice(sellerId, input.slug);
      if (normalPrice === null) return err(domainError("invalid_drop", "Pick one of your live, priced listings."));
      const d = scheduleDrop({ id: newId(), sellerId, normalPrice, ...input, at: clock.now() });
      if (!d.ok) return d;
      await drops.save(d.value);
      return ok((await dropViews([d.value], null))[0]);
    },

    async cancelDrop(sellerId: string, id: string): Promise<Result<{ id: string }, DropError>> {
      const d = await drops.find(id);
      if (!d || d.sellerId !== sellerId) return err(domainError("not_found", "No such drop."));
      await drops.save({ ...d, cancelled: true });
      await reminders.removeKey(dropKey(id));
      return ok({ id });
    },

    /** Reminds this person 10 minutes before the drop opens (signed-in people only). */
    async remind(accountId: string, id: string, on: boolean): Promise<Result<{ on: boolean }, DropError>> {
      const d = await drops.find(id);
      if (!d || d.cancelled) return err(domainError("not_found", "No such drop."));
      if (on) await reminders.set({ key: dropKey(id), accountId, at: d.startsAt, title: `${d.title} opens in 10 minutes`, link: "/drops" });
      else await reminders.unset(dropKey(id), accountId);
      return ok({ on });
    },

    /** Claims units at the drop price: held for 30 minutes, honoured at checkout. */
    async claim(accountId: string, id: string, qty = 1): Promise<Result<{ price: number; expiresAt: string }, DropError>> {
      const d = await drops.find(id);
      if (!d) return err(domainError("not_found", "No such drop."));
      const now = clock.now();
      return uow.run(async (s) => {
        const problem = canClaim(d, qty, await s.holds.taken(accountId, "drop", id), now);
        if (problem) return err(problem);
        if (!(await s.drops.take(id, qty))) return err(domainError("sold_out", "Every one at the drop price has been claimed."));
        const expiresAt = new Date(now.getTime() + DROP_HOLD_MS);
        await s.holds.add({ id: newId(), accountId, slug: d.slug, price: d.price!, qty, source: "drop", sourceId: id, expiresAt, usedAt: null });
        return ok({ price: dollars(d.price!), expiresAt: expiresAt.toISOString() });
      });
    },

    // ── Team buys ──────────────────────────────────────────────────────────
    async teamOffers(limit = 12): Promise<{ offer: TeamOfferView; open: TeamView[] }[]> {
      const offers = await teams.offers({ startable: true, limit });
      const open = await teams.open(
        offers.map((o) => o.id),
        clock.now(),
        50,
      );
      const views = await Promise.all(open.map((t) => teamView(t, null)));
      return offers.map((o) => ({ offer: offerView(o), open: views.filter((t) => t.offerId === o.id).slice(0, 3) }));
    },

    async sellerTeamOffers(sellerId: string): Promise<TeamOfferView[]> {
      const list = await teams.offers({ sellerId, limit: 50 });
      const stats = await teams.stats(list.map((o) => o.id));
      return list.map((o) => offerView(o, stats.get(o.id) ?? { started: 0, full: 0 }));
    },

    async createTeamOffer(sellerId: string, input: { slug: string; teamPrice: Cents; size: number; hours: number; teams: number }): Promise<Result<TeamOfferView, TeamError>> {
      const fullPrice = await products.livePrice(sellerId, input.slug);
      if (fullPrice === null) return err(domainError("invalid_offer", "Pick one of your live, priced listings."));
      const o = makeTeamOffer({ id: newId(), sellerId, fullPrice, ...input, at: clock.now() });
      if (!o.ok) return o;
      await teams.saveOffer(o.value);
      return ok(offerView(o.value, { started: 0, full: 0 }));
    },

    async setTeamOfferActive(sellerId: string, id: string, active: boolean): Promise<Result<TeamOfferView, TeamError>> {
      const o = await teams.offer(id);
      if (!o || o.sellerId !== sellerId) return err(domainError("not_found", "No such offer."));
      await teams.saveOffer({ ...o, active });
      return ok(offerView({ ...o, active }));
    },

    /** Starts a team (or returns the one this person is already in for the offer). */
    async startTeam(leader: { accountId: string; name: string }, offerId: string): Promise<Result<{ id: string }, TeamError>> {
      const offer = await teams.offer(offerId);
      if (!offer) return err(domainError("not_found", "No such team buy."));
      const now = clock.now();
      const already = await teams.openFor(leader.accountId, offerId, now);
      if (already) return ok({ id: already.id });
      const t = startTeam(offer, { id: newCode(), leader, at: now });
      if (!t.ok) return t;
      return uow.run(async (s) => {
        if (!(await s.teams.reserve(offer.id))) return err(domainError("sold_out", "Every team for this one has been started."));
        if (!(await s.teams.create(t.value))) throw new Error("Team id taken");
        const joined = await join(t.value, leader, s);
        if (!joined.ok) throw new Error(joined.error.message);
        return ok({ id: t.value.id });
      });
    },

    async team(id: string, accountId: string | null): Promise<TeamView | null> {
      const t = /^[a-z2-9]{8}$/.test(id) ? await teams.find(id) : null;
      return t ? teamView(t, accountId) : null;
    },

    async joinTeam(id: string, member: { accountId: string; name: string }): Promise<Result<TeamView, TeamError>> {
      const r = await uow.run(async (s) => {
        const t = await s.teams.lock(id);
        if (!t) return err(domainError("not_found", "No such team."));
        return join(t, member, s);
      });
      return r.ok ? ok(await teamView(r.value, member.accountId)) : r;
    },

    // ── Shared ─────────────────────────────────────────────────────────────
    /** Checkout: the lowest drop or team price this buyer holds for a product. */
    async bestHold(buyerId: string, slug: string): Promise<{ price: Cents; qty: number } | null> {
      const h = await holds.best(buyerId, slug, clock.now());
      return h ? { price: money.cents(h.price), qty: h.qty } : null;
    },

    /** OrderPaid: drop and team prices behind the order are used up. */
    use: (buyerId: string, slugs: readonly string[]) => holds.use(buyerId, slugs, clock.now()),

    /** Lapsed drop claims go back into the drop's stock; teams that ran out of time close. */
    async sweep(limit = 200): Promise<{ returned: number; closed: number }> {
      const now = clock.now();
      let returned = 0;
      for (const h of await holds.lapsed(now, limit)) {
        await uow.run(async (s) => {
          if (!(await s.holds.retire(h.id))) return;
          if (h.source === "drop") {
            await s.drops.give(h.sourceId, h.qty);
            returned += h.qty;
          }
        });
      }
      let closed = 0;
      for (const t of await teams.lapsed(now, limit)) {
        await uow.run(async (s) => {
          if (await s.teams.transition(t.id, "open", "expired")) {
            await s.teams.release(t.offerId);
            closed++;
          }
        });
      }
      return { returned, closed };
    },

    /** Reminders whose moment is 10 minutes away or less, each sent once. */
    async dueReminders(limit = 200): Promise<Reminder[]> {
      const now = clock.now();
      const due = await reminders.due(new Date(now.getTime() + REMIND_BEFORE_MS), limit);
      const sent: Reminder[] = [];
      for (const r of due) if (await reminders.markSent(r.key, r.accountId, now)) sent.push(r);
      return sent;
    },

    /** A reminder for a fixed moment that isn't a drop (e.g. a shopping festival). */
    async remindAt(accountId: string, r: { key: string; at: Date; title: string; link: string }, on: boolean) {
      if (on) await reminders.set({ ...r, accountId });
      else await reminders.unset(r.key, accountId);
    },

    async reminded(accountId: string, key: string) {
      return (await reminders.mine(accountId, [key])).has(key);
    },
  };
}

export type Promos = ReturnType<typeof makePromos>;
