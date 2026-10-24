// Search over the fixtures. The real thing will be a search service; the signatures stay.
import { categories } from "@/fixtures/categories";
import { products } from "@/fixtures/products";
import { profiles } from "@/fixtures/profiles";
import { synonyms } from "@/fixtures/search";
import { sellers } from "@/fixtures/sellers";
import { videos } from "@/fixtures/videos";
import type { CategoryId, Product, SellerKind } from "./types";

export type ProductFilters = {
  minPrice?: number;
  maxPrice?: number;
  categories?: CategoryId[];
  minRating?: number;
  sellerKinds?: SellerKind[];
  onSale?: boolean;
  bulk?: boolean;
  fast?: boolean;
  verified?: boolean;
};

export type ProductSort = "best" | "price-asc" | "price-desc" | "rating" | "sold";

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// Fixtures are dated around 23 Oct 2026.
const today = Date.UTC(2026, 9, 23);

/** Days until the earliest delivery date, or Infinity for "6–8 weeks" style windows. */
export function daysToDelivery(product: Product) {
  if (product.leadTime) return product.leadTime.minDays >= 42 ? Infinity : product.leadTime.minDays;
  const m = /^([A-Z][a-z]{2}) (\d+)/.exec(product.delivery);
  if (!m) return Infinity;
  return Math.round((Date.UTC(2026, months.indexOf(m[1]), Number(m[2])) - today) / 86_400_000);
}

const stopwords = new Set("a an and any best cheap find for good i in me my need of please show some something that the to want with".split(" "));

const words = (q: string) =>
  q
    .toLowerCase()
    .split(/[^a-z0-9\u00c0-\u024f-]+/)
    .filter((w) => w && !stopwords.has(w));

/** The term, its likely singulars, and the shopper words our listings phrase differently. */
function variants(term: string) {
  const forms = [term];
  if (term.length > 3 && term.endsWith("s") && !term.endsWith("ss")) {
    forms.push(term.slice(0, -1)); // panels, hoodies
    if (term.endsWith("ies")) forms.push(`${term.slice(0, -3)}y`); // batteries
    if (/(ch|sh|x|ss)es$/.test(term)) forms.push(term.slice(0, -2)); // smartwatches, boxes
  }
  return [...new Set(forms.flatMap((f) => [f, ...(synonyms[f] ?? [])]))];
}

const currencyWords: Record<string, string> = {
  $: "USD", dollar: "USD", dollars: "USD", usd: "USD", bucks: "USD",
  "\u20a6": "NGN", naira: "NGN", "\u20b5": "GHS", cedi: "GHS", cedis: "GHS", ksh: "KES", shilling: "KES", shillings: "KES",
  rand: "ZAR", "\u20b9": "INR", rupee: "INR", rupees: "INR", "\u20ac": "EUR", euro: "EUR", euros: "EUR",
  "\u00a3": "GBP", pound: "GBP", pounds: "GBP", reais: "BRL", pesos: "MXN",
};

type Amount = { amount: number; currency?: string };
export type Understood = { text: string; max?: Amount; min?: Amount };

const amount = /([$\u20a6\u20b5\u20b9\u20ac\u00a3])?\s*(\d[\d,.]*)\s*(k\b)?\s*([a-z$\u20a6\u20b5\u20b9\u20ac\u00a3]+)?/.source;
const maxPhrase = new RegExp(String.raw`\b(?:under|below|less than|cheaper than|up to|max(?:imum)?)\s+` + amount, "i");
const minPhrase = new RegExp(String.raw`\b(?:over|above|more than|at least|min(?:imum)?)\s+` + amount, "i");

/**
 * Reads plain language like "solar panels under 100 dollars": the price part becomes a
 * filter (in the named currency, or the shopper's own when none is named) and the rest is searched.
 */
export function understand(query: string): Understood {
  const out: Understood = { text: query };
  for (const [re, key] of [[maxPhrase, "max"], [minPhrase, "min"]] as const) {
    const m = re.exec(out.text);
    if (!m) continue;
    const [, symbol, digits, thousands, unit] = m;
    const unitCurrency = unit ? currencyWords[unit.toLowerCase()] : undefined;
    out[key] = { amount: Number(digits.replace(/,/g, "")) * (thousands ? 1000 : 1), currency: symbol ? currencyWords[symbol] : unitCurrency };
    // A trailing word that isn't a currency stays in the query ("under 50 solar" keeps "solar").
    out.text = out.text.replace(m[0], unit && !unitCurrency ? ` ${unit}` : " ");
  }
  out.text = out.text.replace(/\s+/g, " ").trim();
  return out;
}

/** The product's own seller summary when it came from the database, else the fixture. */
const sellerOf = (p: Product) => p.seller ?? sellers[p.sellerId];

function haystack(p: Product) {
  const seller = sellerOf(p);
  const category = categories.find((c) => c.id === p.category)?.label ?? "";
  return [
    { text: p.title.toLowerCase(), weight: 5 },
    { text: category.toLowerCase(), weight: 3 },
    { text: `${seller?.name ?? ""} ${seller?.city ?? ""}`.toLowerCase(), weight: 2 },
    { text: [...p.highlights, ...p.specs.flat()].join(" ").toLowerCase(), weight: 1 },
  ];
}

/** Relevance: every word (or one of its synonyms) must appear; title hits count most. */
function score(p: Product, terms: string[]) {
  const fields = haystack(p);
  let total = 0;
  for (const term of terms) {
    const options = variants(term);
    const best = Math.max(0, ...fields.map((f) => (options.some((o) => f.text.includes(o)) ? f.weight : 0)));
    if (best === 0) return 0;
    total += best;
  }
  return total;
}

export function matchesFilters(p: Product, f: ProductFilters) {
  const price = p.price;
  const seller = sellerOf(p);
  if (f.minPrice !== undefined && (price === undefined || price < f.minPrice)) return false;
  if (f.maxPrice !== undefined && (price === undefined || price > f.maxPrice)) return false;
  if (f.categories?.length && !f.categories.includes(p.category)) return false;
  if (f.minRating && p.rating < f.minRating) return false;
  if (f.sellerKinds?.length && !(seller && f.sellerKinds.includes(seller.kind))) return false;
  if (f.onSale && !p.was) return false;
  if (f.bulk && !p.tiers) return false;
  if (f.fast && daysToDelivery(p) > 10) return false;
  if (f.verified && !seller?.audited) return false;
  return true;
}

/** Ranks any list of products against a query, filters and a sort order. */
export function rankProducts<P extends Product>(list: readonly P[], query: string, filters: ProductFilters = {}, sort: ProductSort = "best"): P[] {
  const terms = words(query);
  const ranked = list
    .map((p) => ({ p, s: terms.length ? score(p, terms) : 1 }))
    .filter(({ p, s }) => s > 0 && matchesFilters(p, filters));
  const price = (p: Product) => p.price ?? Infinity;
  const by: Record<ProductSort, (a: (typeof ranked)[number], b: (typeof ranked)[number]) => number> = {
    best: (a, b) => b.s - a.s || (b.p.sold ?? b.p.reviews) - (a.p.sold ?? a.p.reviews),
    "price-asc": (a, b) => price(a.p) - price(b.p),
    "price-desc": (a, b) => (b.p.price ?? 0) - (a.p.price ?? 0),
    rating: (a, b) => b.p.rating - a.p.rating || b.p.reviews - a.p.reviews,
    sold: (a, b) => (b.p.sold ?? b.p.reviews) - (a.p.sold ?? a.p.reviews),
  };
  return ranked.sort(by[sort]).map(({ p }) => p);
}

/** Searches the design-phase fixtures; database-backed screens use rankProducts on their own list. */
export function searchProducts(query: string, filters: ProductFilters = {}, sort: ProductSort = "best") {
  return rankProducts(products, query, filters, sort);
}

export function searchVideos(query: string) {
  const terms = words(query);
  return videos.filter((v) => {
    const product = products.find((p) => p.slug === v.productSlug);
    const text = [v.caption, v.tags.join(" "), product?.title ?? "", v.place].join(" ").toLowerCase();
    return terms.every((t) => variants(t).some((o) => text.includes(o)));
  });
}

export function searchSellers(query: string) {
  const terms = words(query);
  return Object.values(sellers).filter((s) => {
    const own = products.filter((p) => p.sellerId === s.id).map((p) => p.title);
    const text = [s.name, s.city, s.kind, profiles[s.id]?.bio ?? "", own.join(" ")].join(" ").toLowerCase();
    return terms.every((t) => variants(t).some((o) => text.includes(o)));
  });
}

