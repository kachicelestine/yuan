import { money, ok, type Cents, type Clock, type EventLog, type Result } from "@/shared/kernel";
import { commissionFor, DEFAULT_RATE, isCode, newCode, setRate, setWallet, settle, type AffiliateError, type Commission } from "../domain/affiliate";
import type { ClickRepository, CommissionRepository, CreatorRepository, ProgramRepository } from "../domain/repositories";

/** What affiliates needs to know about an order (ordering owns it). */
export interface OrderSource {
  find(orderId: string): Promise<{ buyerId: string; referral: string | null; shops: { sellerId: string; amount: Cents; slugs: string[] }[] } | null>;
}

/** Whether someone works for a shop (merchants owns memberships). */
export interface ShopMembers {
  runsShop(accountId: string, sellerId: string): Promise<boolean>;
}

export type AffiliatesScope = { commissions: CommissionRepository; events: EventLog };

export type AffiliatesDeps = {
  creators: CreatorRepository;
  programs: ProgramRepository;
  clicks: ClickRepository;
  commissions: CommissionRepository;
  orders: OrderSource;
  members: ShopMembers;
  uow: { run<T>(work: (scope: AffiliatesScope) => Promise<T>): Promise<T> };
  clock: Clock;
  newId: () => string;
  newCode?: () => string;
};

export type CommissionView = { id: string; orderId: string; sellerId: string; slugs: string[]; rate: number; base: number; amount: number; status: Commission["status"]; at: string };

export type CreatorDashboard = {
  code: string;
  wallet: string | null;
  /** The last 28 days. */
  clicks: number;
  orders: number;
  earned: number;
  /** The 28 days before, for the trend. */
  earnedBefore: number;
  /** Waiting for delivery. */
  pending: number;
  /** Eight weeks, oldest first: earned by the week it was earned. */
  weeks: { start: string; earned: number }[];
  /** Products people clicked through to, with the orders they led to. */
  links: { slug: string; clicks: number; orders: number }[];
  recent: CommissionView[];
};

export type ShopProgramView = { rate: number; creators: number; orders: number; paid: number; pending: number; recent: CommissionView[] };

const DAY = 86_400_000;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const dollars = (c: number) => c / 100;
const toView = (c: Commission): CommissionView => ({
  id: c.id,
  orderId: c.orderId,
  sellerId: c.sellerId,
  slugs: [...c.slugs],
  rate: c.rate,
  base: dollars(c.base),
  amount: dollars(c.amount),
  status: c.status,
  at: (c.settledAt ?? c.createdAt).toISOString(),
});

/**
 * The creator programme: codes and links, clicks, the commission each referred order
 * owes, and its fate (earned on delivery, void on refund). Payments moves the money when
 * the shop's parcel is released, asking `forRelease` what the creator is owed.
 */
export function makeAffiliates(deps: AffiliatesDeps) {
  const { creators, programs, clicks, commissions, orders, members, uow, clock, newId } = deps;
  const makeCode = deps.newCode ?? (() => newCode());

  const rateOf = async (sellerId: string) => (await programs.rates([sellerId])).get(sellerId) ?? DEFAULT_RATE;

  async function creatorFor(accountId: string) {
    const existing = await creators.byAccount(accountId);
    if (existing) return existing;
    // A clash with another code is rare (31^7); try a few before giving up.
    for (let i = 0; i < 5; i++) {
      const creator = { accountId, code: makeCode(), wallet: null, createdAt: clock.now() };
      if (await creators.create(creator)) return creator;
      const raced = await creators.byAccount(accountId);
      if (raced) return raced;
    }
    throw new Error("Could not allocate a creator code");
  }

  /** Records what each shop in a referred order owes its creator. Safe to run again. */
  async function attribute(orderId: string): Promise<Commission[]> {
    const existing = await commissions.forOrder(orderId);
    const order = await orders.find(orderId);
    if (!order?.referral || !isCode(order.referral)) return existing;
    const creator = await creators.byCode(order.referral);
    if (!creator) return existing;
    const rates = await programs.rates(order.shops.map((s) => s.sellerId));
    const made: Commission[] = [...existing];
    for (const shop of order.shops) {
      if (existing.some((c) => c.sellerId === shop.sellerId)) continue;
      const c = commissionFor({
        id: newId(),
        orderId,
        sellerId: shop.sellerId,
        creator,
        buyerId: order.buyerId,
        creatorRunsShop: await members.runsShop(creator.accountId, shop.sellerId),
        base: shop.amount,
        rate: rates.get(shop.sellerId) ?? DEFAULT_RATE,
        slugs: shop.slugs,
        at: clock.now(),
      });
      if (c && (await commissions.add(c))) made.push(c);
    }
    return made;
  }

  return {
    attribute,

    /** The account's creator code, made on first use. */
    async me(accountId: string) {
      const c = await creatorFor(accountId);
      return { code: c.code, wallet: c.wallet };
    },

    async setWallet(accountId: string, wallet: string): Promise<Result<{ wallet: string }, AffiliateError>> {
      const updated = setWallet(await creatorFor(accountId), wallet);
      if (!updated.ok) return updated;
      await creators.save(updated.value);
      return ok({ wallet: updated.value.wallet! });
    },

    async walletOf(accountId: string) {
      return (await creators.byAccount(accountId))?.wallet ?? null;
    },

    /** Someone followed a creator link. False when the code is unknown. */
    async click(code: string, slug: string | null): Promise<boolean> {
      if (!isCode(code) || !(await creators.byCode(code))) return false;
      await clicks.add(code, slug ?? "", isoDay(clock.now()));
      return true;
    },

    /** ShipmentDelivered, from payments: what the shop's release owes the creator, if anything. */
    async forRelease(orderId: string, sellerId: string): Promise<{ creatorId: string; amount: Cents } | null> {
      const c = (await attribute(orderId)).find((x) => x.sellerId === sellerId);
      return c && c.status !== "void" ? { creatorId: c.creatorId, amount: c.amount } : null;
    },

    /** The parcel was delivered (earned) or refunded (void). */
    async settle(orderId: string, sellerId: string, outcome: "earned" | "void"): Promise<boolean> {
      return uow.run(async (s) => {
        const c = await s.commissions.find(orderId, sellerId);
        const done = c && settle(c, outcome, clock.now());
        if (!done) return false;
        await s.commissions.save(done.commission);
        if (done.event) await s.events.record(c.id, done.event);
        return true;
      });
    },

    async rate(sellerId: string) {
      return rateOf(sellerId);
    },

    async rates(sellerIds: readonly string[]) {
      const set = await programs.rates(sellerIds);
      return new Map(sellerIds.map((id) => [id, set.get(id) ?? DEFAULT_RATE]));
    },

    async setRate(sellerId: string, rate: number): Promise<Result<{ rate: number }, AffiliateError>> {
      const p = setRate(sellerId, rate, clock.now());
      if (!p.ok) return p;
      await programs.save(p.value);
      return ok({ rate });
    },

    async dashboard(accountId: string): Promise<CreatorDashboard> {
      const me = await creatorFor(accountId);
      const now = clock.now().getTime();
      const since = isoDay(new Date(now - 28 * DAY));
      const [total, bySlug, list] = await Promise.all([clicks.total(me.code, since), clicks.bySlug(me.code, isoDay(new Date(now - 90 * DAY))), commissions.forCreator(accountId, 500)]);
      const at = (c: Commission) => (c.settledAt ?? c.createdAt).getTime();
      const earnedBetween = (from: number, to: number) =>
        money.add(...list.filter((c) => c.status === "earned" && at(c) >= from && at(c) < to).map((c) => c.amount));

      // Weeks start on Monday (UTC), the last one being this week.
      const today = new Date(now);
      const monday = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()) - ((today.getUTCDay() + 6) % 7) * DAY;
      const weeks = Array.from({ length: 8 }, (_, i) => {
        const start = monday - (7 - i) * 7 * DAY;
        return { start: isoDay(new Date(start)), earned: dollars(earnedBetween(start, start + 7 * DAY)) };
      });

      const live = list.filter((c) => c.status !== "void");
      const ordersBySlug = new Map<string, number>();
      for (const c of live) for (const slug of c.slugs) ordersBySlug.set(slug, (ordersBySlug.get(slug) ?? 0) + 1);
      const links = bySlug.filter((s) => s.slug).map((s) => ({ slug: s.slug, clicks: s.clicks, orders: ordersBySlug.get(s.slug) ?? 0 }));
      for (const [slug, n] of ordersBySlug) if (!links.some((l) => l.slug === slug)) links.push({ slug, clicks: 0, orders: n });

      return {
        code: me.code,
        wallet: me.wallet,
        clicks: total,
        orders: new Set(live.filter((c) => c.createdAt.getTime() >= now - 28 * DAY).map((c) => c.orderId)).size,
        earned: dollars(earnedBetween(now - 28 * DAY, now + 1)),
        earnedBefore: dollars(earnedBetween(now - 56 * DAY, now - 28 * DAY)),
        pending: dollars(money.add(...list.filter((c) => c.status === "pending").map((c) => c.amount))),
        weeks,
        links: links.sort((a, b) => b.orders - a.orders || b.clicks - a.clicks).slice(0, 12),
        recent: list.slice(0, 20).map(toView),
      };
    },

    async shopProgram(sellerId: string): Promise<ShopProgramView> {
      const [rate, list] = await Promise.all([rateOf(sellerId), commissions.forSeller(sellerId, 500)]);
      const live = list.filter((c) => c.status !== "void");
      return {
        rate,
        creators: new Set(live.map((c) => c.creatorId)).size,
        orders: live.length,
        paid: dollars(money.add(...list.filter((c) => c.status === "earned").map((c) => c.amount))),
        pending: dollars(money.add(...list.filter((c) => c.status === "pending").map((c) => c.amount))),
        recent: list.slice(0, 10).map(toView),
      };
    },

    /** Creator codes for these accounts, for links in their videos. */
    async codesFor(accountIds: readonly string[]): Promise<Map<string, string>> {
      if (!accountIds.length) return new Map();
      return new Map((await creators.byAccounts(accountIds)).map((c) => [c.accountId, c.code]));
    },

    /** Checks a code before trusting it (e.g. from a cookie). */
    async known(code: string) {
      return isCode(code) && (await creators.byCode(code)) !== null;
    },
  };
}

export type Affiliates = ReturnType<typeof makeAffiliates>;
