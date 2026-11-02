import { domainError, err, money, ok, type Cents, type Clock, type Result } from "@/shared/kernel";
import { auction, CLICK_WINDOW_MS, createCampaign, editCampaign, quality, shouldServe, type AdError, type Campaign, type CampaignInput, type CampaignStatus, type Candidate } from "../domain/ads";
import type { AdStatsRepository, CampaignRepository, DailyStats } from "../domain/repositories";

/** Shops pay for clicks from their ad credit and earnings (payments owns both and the ledger). */
export interface AdBilling {
  available(sellerIds: readonly string[]): Promise<Map<string, Cents>>;
  /** Moves the click's price from the shop's balance; false if it can't pay or was already charged. */
  charge(sellerId: string, amount: Cents, reference: string): Promise<boolean>;
}

/** Which of these listings the shop sells and are live (catalog owns them). */
export interface AdProducts {
  live(sellerId: string, slugs: readonly string[]): Promise<string[]>;
}

/** Videos a shop may boost: published, and showing one of the shop's live listings (content owns them). */
export interface AdVideos {
  find(videoId: string): Promise<{ id: string; sellerId: string; productSlug: string; caption: string; ready: boolean } | null>;
}

/** Signs what an impression may be billed, so a click can't name its own price. */
export interface TokenSigner {
  sign(data: string): string;
  verify(data: string, signature: string): boolean;
}

export type AdsDeps = {
  campaigns: CampaignRepository;
  stats: AdStatsRepository;
  billing: AdBilling;
  products: AdProducts;
  videos: AdVideos;
  signer: TokenSigner;
  clock: Clock;
  newId: () => string;
  random?: () => number;
};

export type CampaignView = {
  id: string;
  name: string;
  slugs: string[];
  bid: number;
  dailyBudget: number;
  status: CampaignStatus;
  /** Set for a video boost. */
  videoId: string | null;
  today: { impressions: number; clicks: number; spend: number };
  total: { impressions: number; clicks: number; spend: number };
};

/** A product (or, for a boost, a video) that can fill a sponsored slot, and the campaign promoting it. */
export type Eligible = { campaignId: string; sellerId: string; slug: string; videoId?: string };
export type Served = { campaignId: string; slug: string; price: number; token: string; videoId?: string };

const ZERO: DailyStats = { impressions: 0, clicks: 0, spend: 0 };
const DAY = 86_400_000;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);
const dollars = (c: number) => c / 100;
const statsView = (s: DailyStats) => ({ impressions: s.impressions, clicks: s.clicks, spend: dollars(s.spend) });

const b64 = (s: string) => Buffer.from(s).toString("base64url");
const unb64 = (s: string) => Buffer.from(s, "base64url").toString();

export function makeAds(deps: AdsDeps) {
  const { campaigns, stats, billing, products, videos, signer, clock, newId } = deps;
  const random = deps.random ?? Math.random;

  const view = (c: Campaign, today: DailyStats, total: DailyStats): CampaignView => ({
    id: c.id,
    name: c.name,
    slugs: [...c.slugs],
    bid: dollars(c.bid),
    dailyBudget: dollars(c.dailyBudget),
    status: c.status,
    videoId: c.videoId,
    today: statsView(today),
    total: statsView(total),
  });

  async function owned(sellerId: string, id: string): Promise<Campaign | null> {
    const c = await campaigns.find(id);
    return c && c.sellerId === sellerId ? c : null;
  }

  return {
    async create(sellerId: string, input: CampaignInput): Promise<Result<CampaignView, AdError>> {
      const c = createCampaign({ ...input, id: newId(), sellerId, owned: await products.live(sellerId, input.slugs), at: clock.now() });
      if (!c.ok) return c;
      await campaigns.save(c.value);
      return ok(view(c.value, ZERO, ZERO));
    },

    /** Boosts a video of one of the shop's products: it shows as a sponsored slide in the feed, paid per tap. */
    async boost(sellerId: string, input: { videoId: string; bid: Cents; dailyBudget: Cents }): Promise<Result<CampaignView, AdError>> {
      const v = await videos.find(input.videoId);
      if (!v || !v.ready || v.sellerId !== sellerId) return err(domainError("invalid_products", "Pick a published video of one of your products."));
      const caption = v.caption.trim().replace(/\s+/g, " ");
      const name = `Boost: ${caption.length > 40 ? `${caption.slice(0, 39)}…` : caption || v.productSlug}`;
      const c = createCampaign({ name, slugs: [v.productSlug], bid: input.bid, dailyBudget: input.dailyBudget, videoId: v.id, id: newId(), sellerId, owned: await products.live(sellerId, [v.productSlug]), at: clock.now() });
      if (!c.ok) return c;
      await campaigns.save(c.value);
      return ok(view(c.value, ZERO, ZERO));
    },

    async update(sellerId: string, id: string, patch: Partial<CampaignInput> & { status?: CampaignStatus }): Promise<Result<CampaignView, AdError>> {
      const c = await owned(sellerId, id);
      if (!c) return err(domainError("not_found", "No such campaign."));
      const next = editCampaign(c, patch, patch.slugs ? await products.live(sellerId, patch.slugs) : [], clock.now());
      if (!next.ok) return next;
      await campaigns.save(next.value);
      const [today, total] = await Promise.all([stats.day([id], isoDay(clock.now())), stats.lifetime([id])]);
      return ok(view(next.value, today.get(id) ?? ZERO, total.get(id) ?? ZERO));
    },

    async list(sellerId: string): Promise<CampaignView[]> {
      const list = await campaigns.forSeller(sellerId);
      const ids = list.map((c) => c.id);
      const [today, total] = await Promise.all([stats.day(ids, isoDay(clock.now())), stats.lifetime(ids)]);
      return list.map((c) => view(c, today.get(c.id) ?? ZERO, total.get(c.id) ?? ZERO));
    },

    /** Every listing being advertised right now (in search and category slots), with its campaign. */
    async promoted(): Promise<Eligible[]> {
      return (await campaigns.active()).filter((c) => !c.videoId).flatMap((c) => c.slugs.map((slug) => ({ campaignId: c.id, sellerId: c.sellerId, slug })));
    },

    /** Every boosted video running right now, for the feed's sponsored slides. */
    async promotedVideos(): Promise<Eligible[]> {
      return (await campaigns.active()).flatMap((c) => (c.videoId && c.slugs[0] ? [{ campaignId: c.id, sellerId: c.sellerId, slug: c.slugs[0], videoId: c.videoId }] : []));
    },

    /**
     * Fills up to `slots` sponsored slots from the eligible listings: drops campaigns that
     * have spent today's budget (or are ahead of pace) or whose shop can't pay a click,
     * runs the auction, counts the impressions and signs what each click will cost.
     */
    async serve(eligible: readonly Eligible[], slots: number): Promise<Served[]> {
      if (!eligible.length || slots < 1) return [];
      const now = clock.now();
      const day = isoDay(now);
      const byId = new Map((await campaigns.active()).map((c) => [c.id, c]));
      const live = eligible.filter((e) => byId.has(e.campaignId));
      const ids = [...new Set(live.map((e) => e.campaignId))];
      const [today, total, balances] = await Promise.all([stats.day(ids, day), stats.lifetime(ids), billing.available([...new Set(live.map((e) => e.sellerId))])]);
      const dayElapsed = (now.getTime() % DAY) / DAY;

      const candidates: Candidate[] = [];
      const picked = new Set<string>();
      for (const e of live) {
        const c = byId.get(e.campaignId)!;
        // One listing per campaign per placement: the first eligible one (best match first).
        if (picked.has(c.id)) continue;
        if ((balances.get(c.sellerId) ?? 0) < c.bid) continue;
        if (!shouldServe(money.cents((today.get(c.id) ?? ZERO).spend), c.dailyBudget, dayElapsed, random())) continue;
        const life = total.get(c.id) ?? ZERO;
        picked.add(c.id);
        candidates.push({ campaignId: c.id, sellerId: c.sellerId, slug: e.slug, bid: c.bid, quality: quality(life.impressions, life.clicks) });
      }

      const wins = auction(candidates, slots);
      if (!wins.length) return [];
      await stats.addImpressions(
        wins.map((w) => w.campaignId),
        day,
      );
      return wins.map((w) => {
        const data = b64(JSON.stringify({ c: w.campaignId, s: w.slug, p: w.price, t: now.getTime(), n: newId() }));
        const videoId = byId.get(w.campaignId)?.videoId ?? undefined;
        return { campaignId: w.campaignId, slug: w.slug, price: dollars(w.price), token: `${data}.${signer.sign(data)}`, ...(videoId && { videoId }) };
      });
    },

    /** A sponsored listing was tapped: bill it once, if the token is genuine and fresh. */
    async click(token: string): Promise<{ billed: boolean; slug: string | null }> {
      const [data, signature] = token.split(".");
      if (!data || !signature || !signer.verify(data, signature)) return { billed: false, slug: null };
      let t: { c: string; s: string; p: number; t: number; n: string };
      try {
        t = JSON.parse(unb64(data));
      } catch {
        return { billed: false, slug: null };
      }
      const now = clock.now();
      if (!(now.getTime() - t.t <= CLICK_WINDOW_MS && now.getTime() >= t.t - 60_000)) return { billed: false, slug: t.s };
      const c = await campaigns.find(t.c);
      if (!c || c.status !== "active") return { billed: false, slug: t.s };
      const price = money.cents(Math.min(t.p, c.bid));
      // The ledger reference is the impression, so a repeated click is never charged twice.
      const billed = await billing.charge(c.sellerId, price, `ad-click:${t.n}`);
      if (billed) await stats.addClick(c.id, isoDay(now), price);
      return { billed, slug: t.s };
    },
  };
}

export type Ads = ReturnType<typeof makeAds>;
