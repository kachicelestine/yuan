import { MAX_QTY } from "./order";

/** What a buyer means to order. Prices aren't stored: they come from the catalog when read. */
export type CartItem = Readonly<{
  slug: string;
  /** Picked option labels joined as "M · Ink", or null for the defaults. */
  option: string | null;
  qty: number;
  /** Where it came from, e.g. "LIVE PRICE HELD" or "Gift for Ada". Display only. */
  note: string | null;
}>;

export const MAX_CART_LINES = 50;

export const cartKey = (i: Pick<CartItem, "slug" | "option">) => `${i.slug}:${i.option ?? ""}`;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Cleans a bag from any source: drops malformed lines, folds duplicates together
 * (adding quantities), clamps quantities and caps the number of lines.
 */
export function normalizeCart(items: readonly CartItem[]): CartItem[] {
  const byKey = new Map<string, CartItem>();
  for (const i of items) {
    if (!SLUG.test(i.slug) || !Number.isFinite(i.qty)) continue;
    const qty = Math.trunc(i.qty);
    if (qty < 1) continue;
    const option = i.option?.trim() || null;
    const key = cartKey({ slug: i.slug, option });
    const prev = byKey.get(key);
    byKey.set(key, { slug: i.slug, option, note: prev?.note ?? i.note?.slice(0, 80) ?? null, qty: Math.min(MAX_QTY, (prev?.qty ?? 0) + qty) });
  }
  return [...byKey.values()].slice(0, MAX_CART_LINES);
}

/**
 * Merges the bag on this device into the account's bag at sign-in. The same item in
 * both keeps the larger quantity (not the sum), so signing in twice never doubles it.
 */
export function mergeCarts(account: readonly CartItem[], device: readonly CartItem[]): CartItem[] {
  const merged = new Map(normalizeCart(account).map((i) => [cartKey(i), i]));
  for (const i of normalizeCart(device)) {
    const prev = merged.get(cartKey(i));
    merged.set(cartKey(i), prev ? { ...prev, qty: Math.max(prev.qty, i.qty), note: prev.note ?? i.note } : i);
  }
  return [...merged.values()].slice(0, MAX_CART_LINES);
}
