import { cartKey, mergeCarts, normalizeCart, type CartItem } from "../domain/cart";
import type { CartRepository } from "../domain/repositories";
import type { OrderCatalog } from "./ports";

/** A bag line as the UI shows it, priced by the catalog for its quantity. */
export type CartLineView = {
  key: string;
  slug: string;
  option: string | undefined;
  qty: number;
  note: string | undefined;
  title: string;
  image: string;
  /** Dollars per unit at this quantity. */
  unitPrice: number;
};

export function makeCart(deps: { carts: CartRepository; catalog: OrderCatalog }) {
  /** Prices each line; lines that can't be bought any more (removed, now quote-only) drop out. */
  async function view(items: readonly CartItem[]): Promise<CartLineView[]> {
    const lines = await Promise.all(
      items.map(async (i) => {
        const priced = await deps.catalog.priceLine(i.slug, i.option, i.qty);
        if (!priced.ok) return null;
        const p = priced.value;
        return { key: cartKey(i), slug: i.slug, option: i.option ?? undefined, qty: i.qty, note: i.note ?? undefined, title: p.title, image: p.image, unitPrice: p.unitPrice / 100 };
      }),
    );
    return lines.filter((l): l is CartLineView => l !== null);
  }

  return {
    async get(buyerId: string) {
      return view(await deps.carts.get(buyerId));
    },
    /** Saves the bag as the device has it now (the device is the source of truth after sign-in). */
    async replace(buyerId: string, items: readonly CartItem[]) {
      const clean = normalizeCart(items);
      await deps.carts.replace(buyerId, clean);
      return view(clean);
    },
    /** At sign-in: folds the device's bag into the account's. */
    async merge(buyerId: string, device: readonly CartItem[]) {
      const merged = mergeCarts(await deps.carts.get(buyerId), device);
      await deps.carts.replace(buyerId, merged);
      return view(merged);
    },
  };
}

export type Cart = ReturnType<typeof makeCart>;
