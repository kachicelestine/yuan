import { money } from "@/shared/kernel";
import type { Category } from "../domain/category";
import type { LeadTime, Product } from "../domain/product";
import type { Seller, SellerKind } from "../domain/seller";

// Read models for the UI: plain, serializable, money in dollars for display. They keep
// the shapes the design-phase components already use, so screens move to the database
// without being rewritten. Never do money math on a view; use the domain with cents.

export type CategoryView = {
  id: string;
  label: string;
  image: string;
  hero: string;
  blurb: string;
  subcategories: string[];
};

export type SellerView = {
  id: string;
  name: string;
  kind: SellerKind;
  city: string;
  avatar: string;
  verified: boolean;
  audited?: string;
  years?: number;
};

export type StorefrontView = {
  cover: string;
  bio: string;
  followers: number;
  rating: number;
  responseHours: number;
  onTime: number;
  certificates: string[];
  capacity?: string;
  staff?: number;
  floorArea?: string;
  exportsTo: string[];
};

/** Just enough of the seller to show on a product card. */
export type SellerSummary = Pick<SellerView, "id" | "name" | "avatar" | "verified" | "kind" | "city" | "audited">;

export type ProductView = {
  id: string;
  slug: string;
  title: string;
  category: string;
  sellerId: string;
  images: string[];
  price?: number;
  was?: number;
  tiers?: { min: number; price: number }[];
  moq?: number;
  rating: number;
  reviews: number;
  sold?: number;
  options?: { name: string; values: { label: string; sub?: string; delta?: number; swatch?: string; soldOut?: boolean }[]; defaultIndex?: number }[];
  /** Units left, when the shop counts them. */
  stock?: number;
  highlights: string[];
  specs: [string, string][];
  buyersSay?: string;
  shipsFrom: string;
  /** Delivery window as of the render date, e.g. "Nov 4–9" or "6–8 weeks". */
  delivery: string;
  leadTime: { minDays: number; maxDays: number };
  dutyRate: number;
  seller?: SellerSummary;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY = 86_400_000;

/**
 * "Nov 4–9" within a month, "Oct 30–Nov 3" across months, and "6–8 weeks" once the
 * earliest date is six weeks out (made-to-order and sea freight), where dates feel false.
 */
export function formatDeliveryWindow(lead: LeadTime, from: Date): string {
  if (lead.minDays >= 42) return `${Math.round(lead.minDays / 7)}–${Math.round(lead.maxDays / 7)} weeks`;
  const start = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const a = new Date(start + lead.minDays * DAY);
  const b = new Date(start + lead.maxDays * DAY);
  const am = MONTHS[a.getUTCMonth()];
  const bm = MONTHS[b.getUTCMonth()];
  return am === bm ? `${am} ${a.getUTCDate()}–${b.getUTCDate()}` : `${am} ${a.getUTCDate()}–${bm} ${b.getUTCDate()}`;
}

const dollars = money.toDollars;
const opt = <T>(value: T | null): T | undefined => value ?? undefined;

export function toProductView(p: Product, today: Date, seller?: Seller): ProductView {
  return {
    id: p.id,
    slug: p.slug,
    title: p.title,
    category: p.categoryId,
    sellerId: p.sellerId,
    images: [...p.images],
    price: p.price === null ? undefined : dollars(p.price),
    was: p.was === null ? undefined : dollars(p.was),
    tiers: p.tiers.length ? p.tiers.map((t) => ({ min: t.minQty, price: dollars(t.price) })) : undefined,
    moq: p.minOrder > 1 ? p.minOrder : undefined,
    rating: p.rating,
    reviews: p.reviewCount,
    sold: opt(p.soldCount),
    options: p.options.length
      ? p.options.map((o) => ({
          name: o.name,
          defaultIndex: o.defaultIndex || undefined,
          values: o.values.map((v) => ({ label: v.label, sub: opt(v.sub), delta: v.delta ? dollars(v.delta) : undefined, swatch: opt(v.swatch), ...(v.soldOut && { soldOut: true }) })),
        }))
      : undefined,
    highlights: [...p.highlights],
    specs: p.specs.map(([k, v]) => [k, v]),
    buyersSay: opt(p.buyersSay),
    shipsFrom: p.shipsFrom,
    delivery: formatDeliveryWindow(p.leadTime, today),
    leadTime: { ...p.leadTime },
    dutyRate: p.dutyRate,
    ...(p.stock != null && { stock: p.stock }),
    seller: seller && { id: seller.id, name: seller.name, avatar: seller.avatar, verified: seller.verified, kind: seller.kind, city: seller.city, audited: opt(seller.audited) },
  };
}

export const toCategoryView = (c: Category): CategoryView => ({ id: c.id, label: c.label, image: c.image, hero: c.hero, blurb: c.blurb, subcategories: [...c.subcategories] });

export const toSellerView = (s: Seller): SellerView => ({
  id: s.id,
  name: s.name,
  kind: s.kind,
  city: s.city,
  avatar: s.avatar,
  verified: s.verified,
  audited: opt(s.audited),
  years: opt(s.yearsInBusiness),
});

export function toStorefrontView(s: Seller): StorefrontView | null {
  const f = s.storefront;
  if (!f) return null;
  return {
    cover: f.cover,
    bio: f.bio,
    followers: f.followers,
    rating: f.rating,
    responseHours: f.responseHours,
    onTime: f.onTimeRate,
    certificates: [...f.certificates],
    capacity: opt(f.capacity),
    staff: opt(f.staff),
    floorArea: opt(f.floorArea),
    exportsTo: [...f.exportsTo],
  };
}
