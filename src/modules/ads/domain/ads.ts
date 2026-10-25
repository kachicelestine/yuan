import { domainError, err, money, ok, type Cents, type DomainError, type Result } from "@/shared/kernel";

// Sponsored listings. A shop promotes some of its listings with a price it will pay per
// click and a daily budget. Where a sponsored slot is shown, the eligible ads compete in a
// second-price auction weighted by how often each one gets clicked, so a relevant ad can
// beat a richer one; the winner pays just enough to keep its place. Money comes from the
// shop's earnings balance, one click at a time.

export const MIN_BID = money.fromDollars(0.05);
export const MAX_BID = money.fromDollars(5);
export const MIN_BUDGET = money.fromDollars(1);
export const MAX_BUDGET = money.fromDollars(1000);
export const MAX_PRODUCTS = 20;
/** A click counts if it comes within this long of the ad being shown. */
export const CLICK_WINDOW_MS = 30 * 60_000;

export type CampaignStatus = "active" | "paused";

export type Campaign = Readonly<{
  id: string;
  sellerId: string;
  name: string;
  slugs: readonly string[];
  /** The most the shop pays for one click. */
  bid: Cents;
  dailyBudget: Cents;
  status: CampaignStatus;
  createdAt: Date;
  updatedAt: Date;
}>;

export type AdError = DomainError<"invalid_bid" | "invalid_budget" | "invalid_products" | "invalid_name" | "not_found">;

export type CampaignInput = { name: string; slugs: readonly string[]; bid: Cents; dailyBudget: Cents };

function check(input: CampaignInput, owned: readonly string[]): AdError | null {
  if (input.name.trim().length < 2 || input.name.trim().length > 60) return domainError("invalid_name", "Give the campaign a short name.");
  if (!Number.isInteger(input.bid) || input.bid < MIN_BID || input.bid > MAX_BID) return domainError("invalid_bid", "Bid between $0.05 and $5.00 a click.");
  if (!Number.isInteger(input.dailyBudget) || input.dailyBudget < MIN_BUDGET || input.dailyBudget > MAX_BUDGET) return domainError("invalid_budget", "Set a daily budget between $1 and $1,000.");
  if (input.dailyBudget < input.bid) return domainError("invalid_budget", "The daily budget must cover at least one click.");
  const slugs = [...new Set(input.slugs)];
  if (!slugs.length || slugs.length > MAX_PRODUCTS) return domainError("invalid_products", `Pick 1 to ${MAX_PRODUCTS} of your live listings.`);
  if (slugs.some((s) => !owned.includes(s))) return domainError("invalid_products", "You can only promote your own live listings.");
  return null;
}

export function createCampaign(props: CampaignInput & { id: string; sellerId: string; owned: readonly string[]; at: Date }): Result<Campaign, AdError> {
  const problem = check(props, props.owned);
  if (problem) return err(problem);
  return ok({
    id: props.id,
    sellerId: props.sellerId,
    name: props.name.trim(),
    slugs: [...new Set(props.slugs)],
    bid: props.bid,
    dailyBudget: props.dailyBudget,
    status: "active",
    createdAt: props.at,
    updatedAt: props.at,
  });
}

export function editCampaign(c: Campaign, patch: Partial<CampaignInput> & { status?: CampaignStatus }, owned: readonly string[], at: Date): Result<Campaign, AdError> {
  const next = { name: patch.name ?? c.name, slugs: patch.slugs ?? c.slugs, bid: patch.bid ?? c.bid, dailyBudget: patch.dailyBudget ?? c.dailyBudget };
  // Listings since taken down may stay in an untouched campaign; they just stop showing.
  const problem = check(next, patch.slugs ? owned : [...owned, ...c.slugs]);
  if (problem) return err(problem);
  return ok({ ...c, ...next, name: next.name.trim(), slugs: [...new Set(next.slugs)], status: patch.status ?? c.status, updatedAt: at });
}

/** How likely an ad is to be clicked, relative to a typical ad: smoothed so new ads start at 1. */
export function quality(impressions: number, clicks: number) {
  const PRIOR_CTR = 0.02;
  const PRIOR_WEIGHT = 200;
  const ctr = (clicks + PRIOR_CTR * PRIOR_WEIGHT) / (impressions + PRIOR_WEIGHT);
  return Math.min(3, Math.max(0.3, ctr / PRIOR_CTR));
}

export type Candidate = Readonly<{ campaignId: string; sellerId: string; slug: string; bid: Cents; quality: number }>;
export type Win = Candidate & { price: Cents };

/**
 * Generalised second-price auction: ranked by bid × quality, one slot per shop, and each
 * winner pays the least it could have bid to keep its rank (plus a cent), never more
 * than its own bid. The last winner pays the reserve if nobody ranked below it.
 */
export function auction(candidates: readonly Candidate[], slots: number, reserve: Cents = MIN_BID): Win[] {
  const ranked = [...candidates].sort((a, b) => b.bid * b.quality - a.bid * a.quality || a.campaignId.localeCompare(b.campaignId));
  const seen = new Set<string>();
  const distinct = ranked.filter((c) => (seen.has(c.sellerId) ? false : (seen.add(c.sellerId), true)));
  return distinct.slice(0, slots).map((c, i) => {
    const next = distinct[i + 1];
    const needed = next ? Math.floor((next.bid * next.quality) / c.quality) + 1 : reserve;
    return { ...c, price: money.cents(Math.min(c.bid, Math.max(reserve, needed))) };
  });
}

/**
 * Spreads a budget over the day: an ad that has spent more than the day so far allows
 * (with some slack) sits out some auctions. `random` is in [0, 1).
 */
export function shouldServe(spent: Cents, budget: Cents, dayElapsed: number, random: number) {
  if (spent >= budget) return false;
  const pace = spent / budget;
  const allowed = Math.min(1, dayElapsed + 0.15);
  if (pace <= allowed) return true;
  // Ahead of schedule: serve less the further ahead it is.
  return random < Math.max(0.1, 1 - (pace - allowed) * 4);
}
