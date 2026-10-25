import { cartKey, mergeCarts, normalizeCart, type CartItem } from "../domain/cart";
import type { CartRepository } from "../domain/repositories";
import { holdCovers, type OrderCatalog, type PriceHolds } from "./ports";

/** A bag line as the UI shows it, priced by the catalog for its quantity. */
export type CartLineView = {
  key: string;
  slug: string;
  option: string | undefined;
  qty: number;
  note: string | undefined;
  title: string;
  image: string;
  /** Dollars per unit at this quantity (a price the buyer holds, when lower). */
  unitPrice: number;
};

export function makeCart(deps: { carts: CartRepository; catalog: OrderCatalog; holds?: PriceHolds }) {
  /** Prices each line as checkout will; lines that can't be bought (removed, quote-only without a quote) drop out. */
  async function view(buyerId: string, items: readonly CartItem[]): Promise<CartLineView[]> {
    const lines = await Promise.all(
      items.map(async (i) => {
        const priced = await deps.catalog.priceLine(i.slug, i.option, i.qty);
        if (!priced.ok) return null;
        const p = priced.value;
        const hold = deps.holds ? await deps.holds.best(buyerId, i.slug, i.qty) : null;
        const price = hold && holdCovers(hold, i.qty) && (p.unitPrice === null || hold.price < p.unitPrice) ? hold.price : p.unitPrice;
        if (price === null) return null;
        return { key: cartKey(i), slug: i.slug, option: i.option ?? undefined, qty: i.qty, note: i.note ?? undefined, title: p.title, image: p.image, unitPrice: price / 100 };
      }),
    );
    return lines.filter((l): l is CartLineView => l !== null);
  }

  return {
    async get(buyerId: string) {
      return view(buyerId, await deps.carts.get(buyerId));
    },
    /** Saves the bag as the device has it now (the device is the source of truth after sign-in). */
    async replace(buyerId: string, items: readonly CartItem[]) {
      const clean = normalizeCart(items);
      await deps.carts.replace(buyerId, clean);
      return view(buyerId, clean);
    },
    /** At sign-in: folds the device's bag into the account's. */
    async merge(buyerId: string, device: readonly CartItem[]) {
      const merged = mergeCarts(await deps.carts.get(buyerId), device);
      await deps.carts.replace(buyerId, merged);
      return view(buyerId, merged);
    },
  };
}

export type Cart = ReturnType<typeof makeCart>;
