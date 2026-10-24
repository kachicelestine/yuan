// Leaderboards built from the fixture catalog. Movement and period volumes are seeded from
// the slug so they stay stable between renders; real numbers will come from orders.
import { getSellerProfile, products, productsBySeller, sellers } from "@/lib/catalog";
import { compact } from "@/lib/format";
import type { CategoryId, Product, Seller } from "@/lib/types";

export type Period = "day" | "week" | "month";
export type BoardId = "hot" | "saved" | "rated" | "factories";

export const boards: { id: BoardId; label: string; blurb: string }[] = [
  { id: "hot", label: "Best sellers", blurb: "Most ordered" },
  { id: "saved", label: "Most saved", blurb: "Added to wishlists" },
  { id: "rated", label: "Top rated", blurb: "Highest scores with 50+ reviews" },
  { id: "factories", label: "Rising factories", blurb: "Fastest-growing followings" },
];

export const periods: { id: Period; label: string }[] = [
  { id: "day", label: "Today" },
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
];

/** Share of lifetime volume that lands in each window. */
const share: Record<Period, number> = { day: 0.012, week: 0.07, month: 0.28 };
const periodSalt: Record<Period, number> = { day: 1, week: 7, month: 30 };

function seed(text: string, salt: number) {
  let h = salt * 2654435761;
  for (const c of text) h = (Math.imul(h ^ c.charCodeAt(0), 2246822519) >>> 0) + 3266489917;
  return (h >>> 0) % 1000;
}

/** Places moved since the last window: positive is up; null means new on the board. */
export type Move = number | null;

function move(key: string, period: Period, rank: number): Move {
  const s = seed(key, periodSalt[period] + 11);
  if (s % 11 === 0 && rank > 2) return null;
  return (s % 9) - 3;
}

export type RankedProduct = { kind: "product"; product: Product; metric: string; detail: string; move: Move };
export type RankedSeller = { kind: "seller"; seller: Seller; metric: string; detail: string; move: Move; growth: number; picks: Product[] };

export function rankProducts(board: Exclude<BoardId, "factories">, period: Period, category?: CategoryId): RankedProduct[] {
  const pool = products.filter((p) => !category || p.category === category);
  const jitter = (p: Product) => 0.7 + seed(p.slug, periodSalt[period]) / 1600;
  const scored = pool.map((p) => {
    if (board === "hot") {
      const n = Math.max(3, Math.round((p.sold ?? p.reviews * 3) * share[period] * jitter(p)));
      return { p, score: n, metric: `${compact(n)} sold`, detail: `${compact(p.sold ?? p.reviews * 3)} all time` };
    }
    if (board === "saved") {
      const n = Math.max(5, Math.round(p.reviews * 2.4 * share[period] * jitter(p) * 4));
      return { p, score: n, metric: `${compact(n)} saves`, detail: `★ ${p.rating} · ${compact(p.reviews)} reviews` };
    }
    return { p, score: p.reviews >= 50 ? p.rating * 10_000 + p.reviews : -1, metric: `★ ${p.rating}`, detail: `${compact(p.reviews)} reviews` };
  });
  return scored
    .filter((s) => s.score >= 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20)
    .map((s, i) => ({ kind: "product", product: s.p, metric: s.metric, detail: s.detail, move: move(s.p.slug, period, i) }));
}

export function rankSellers(period: Period, category?: CategoryId): RankedSeller[] {
  return Object.values(sellers)
    .map((seller) => {
      const picks = productsBySeller(seller.id).filter((p) => !category || p.category === category);
      const profile = getSellerProfile(seller.id);
      const growth = (4 + (seed(seller.id, periodSalt[period]) % 38)) * (period === "day" ? 0.2 : period === "week" ? 1 : 2.6);
      return { seller, picks, profile, growth };
    })
    .filter((s) => s.picks.length > 0 && s.profile)
    .sort((a, b) => b.growth - a.growth)
    .slice(0, 12)
    .map((s, i) => ({
      kind: "seller",
      seller: s.seller,
      picks: s.picks.slice(0, 3),
      growth: s.growth,
      metric: `+${s.growth.toFixed(s.growth < 10 ? 1 : 0)}%`,
      detail: `${compact(Math.round(s.profile!.followers * (s.growth / 100)))} new followers · ★ ${s.profile!.rating}`,
      move: move(s.seller.id, period, i),
    }));
}
