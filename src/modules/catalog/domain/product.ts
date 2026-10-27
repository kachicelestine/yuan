import { domainError, err, money, ok, type Cents, type DomainError, type Result } from "@/shared/kernel";
import type { CategoryId } from "./category";
import type { SellerId } from "./seller";

/**
 * draft, active and archived are the seller's to choose. removed (a moderator took it down)
 * and suspended (the whole shop is suspended) are locked: only an admin changes them.
 */
export type ProductStatus = "draft" | "active" | "archived" | "removed" | "suspended";
export const LOCKED_STATUSES: readonly ProductStatus[] = ["removed", "suspended"];
export const isLocked = (s: ProductStatus) => LOCKED_STATUSES.includes(s);

/** A volume price: from `minQty` units, each costs `price`. */
export type Tier = Readonly<{ minQty: number; price: Cents }>;

export type OptionValue = Readonly<{
  label: string;
  /** Secondary line, e.g. "Ships in 3 days". */
  sub: string | null;
  /** Added to every tier price when picked. */
  delta: Cents;
  /** CSS colour for colour options. */
  swatch: string | null;
}>;

export type ProductOption = Readonly<{ name: string; values: readonly OptionValue[]; defaultIndex: number }>;

/** Days from order to door before any country-specific transit time. */
export type LeadTime = Readonly<{ minDays: number; maxDays: number }>;

export type Product = Readonly<{
  id: string;
  slug: string;
  title: string;
  categoryId: CategoryId;
  sellerId: SellerId;
  status: ProductStatus;
  images: readonly string[];
  /** Price at the lowest tier. Null for quote-only items (cars, custom work). */
  price: Cents | null;
  /** Previous price, shown struck through. */
  was: Cents | null;
  tiers: readonly Tier[];
  minOrder: number;
  rating: number;
  reviewCount: number;
  soldCount: number | null;
  options: readonly ProductOption[];
  highlights: readonly string[];
  specs: readonly (readonly [string, string])[];
  buyersSay: string | null;
  shipsFrom: string;
  leadTime: LeadTime;
  /** Share of the item price owed as import duty, 0–1. */
  dutyRate: number;
  /** Why a moderator removed it, shown to the seller. */
  moderationNote?: string | null;
}>;

export type ProductError = DomainError<"invalid_product">;

const invalid = (message: string): Result<never, ProductError> => err(domainError("invalid_product", message));

/**
 * The only way to make a Product: checks every rule a listing must meet, so an
 * invalid product can't exist anywhere in the system.
 */
export function createProduct(props: Omit<Product, "status"> & { status?: ProductStatus }): Result<Product, ProductError> {
  const p = { status: "active" as const, ...props };
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(p.slug)) return invalid(`slug "${p.slug}" must be lower-case words joined by hyphens`);
  if (p.title.trim().length < 3 || p.title.length > 140) return invalid("title must be 3–140 characters");
  if (p.images.length === 0) return invalid("a product needs at least one image");
  if (p.price !== null && p.price <= 0) return invalid("price must be positive, or null for quote-only items");
  if (p.was !== null && (p.price === null || p.was <= p.price)) return invalid("the previous price must be higher than the price");
  if (!Number.isInteger(p.minOrder) || p.minOrder < 1) return invalid("minimum order must be a whole number from 1");
  if (p.price === null && p.tiers.length > 0) return invalid("quote-only items can't have price tiers");
  for (let i = 0; i < p.tiers.length; i++) {
    const t = p.tiers[i];
    const prev = p.tiers[i - 1];
    if (t.minQty < 1 || t.price <= 0) return invalid("tier quantities and prices must be positive");
    if (prev && (t.minQty <= prev.minQty || t.price > prev.price)) return invalid("tiers must go up in quantity and not up in price");
  }
  if (p.rating < 0 || p.rating > 5) return invalid("rating must be between 0 and 5");
  if (p.dutyRate < 0 || p.dutyRate > 1) return invalid("duty rate must be a fraction between 0 and 1");
  if (p.leadTime.minDays < 1 || p.leadTime.maxDays < p.leadTime.minDays) return invalid("lead time must be at least a day, min ≤ max");
  for (const o of p.options) {
    if (o.values.length === 0) return invalid(`option "${o.name}" needs at least one value`);
    if (o.defaultIndex < 0 || o.defaultIndex >= o.values.length) return invalid(`option "${o.name}" default is out of range`);
  }
  return ok(p);
}

/** What one unit costs when buying `qty`, after volume tiers and the picked options' surcharge. */
export function unitPrice(product: Pick<Product, "price" | "tiers">, qty: number, delta: Cents = money.ZERO): Cents {
  const base = product.price ?? money.ZERO;
  const tier = [...product.tiers].reverse().find((t) => qty >= t.minQty);
  return money.add(tier?.price ?? base, delta);
}

export const isQuoteOnly = (product: Pick<Product, "price">) => product.price === null;
