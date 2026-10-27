import type { Clock } from "@/shared/kernel";
import type { CategoryId } from "../domain/category";
import type { Product } from "../domain/product";
import type { CategoryRepository, ProductRepository, SellerRepository } from "../domain/repositories";
import type { SellerId } from "../domain/seller";
import { toCategoryView, toProductView, toSellerView, toStorefrontView, type CategoryView, type ProductView, type SellerView, type StorefrontView } from "./views";

export type CatalogDeps = {
  categories: CategoryRepository;
  sellers: SellerRepository;
  products: ProductRepository;
  clock: Clock;
};

export type SellerPage = { seller: SellerView; storefront: StorefrontView | null };

/** Read use cases for the catalog. Each returns views ready for the UI. */
export function makeCatalogQueries({ categories, sellers, products, clock }: CatalogDeps) {
  /** Views for a list of products, with each seller fetched once. */
  const view = async (list: Product[]): Promise<ProductView[]> => {
    const owners = await sellers.findByIds([...new Set(list.map((p) => p.sellerId))]);
    const byId = new Map(owners.map((s) => [s.id, s]));
    const today = clock.now();
    return list.map((p) => toProductView(p, today, byId.get(p.sellerId)));
  };

  return {
    async listCategories(): Promise<CategoryView[]> {
      return (await categories.list()).map(toCategoryView);
    },

    async getCategory(id: string): Promise<CategoryView | null> {
      const c = await categories.findById(id as CategoryId);
      return c && toCategoryView(c);
    },

    async getProduct(slug: string): Promise<ProductView | null> {
      const p = await products.findBySlug(slug);
      return p && toProductView(p, clock.now(), (await sellers.findById(p.sellerId)) ?? undefined);
    },

    /** Products in the order asked for; unknown slugs drop out. */
    async getProductsBySlugs(slugs: readonly string[]): Promise<ProductView[]> {
      const found = new Map((await products.findBySlugs(slugs)).map((p) => [p.slug, p]));
      return view(slugs.flatMap((s) => found.get(s) ?? []));
    },

    async listProducts(filter: { category?: string; seller?: string; limit?: number } = {}): Promise<ProductView[]> {
      return view(await products.list({ categoryId: filter.category as CategoryId | undefined, sellerId: filter.seller as SellerId | undefined, limit: filter.limit }));
    },

    /** Other sellers' products in the same category, the comparison a buyer actually makes. */
    async similarProducts(slug: string, limit = 4): Promise<ProductView[]> {
      const p = await products.findBySlug(slug);
      if (!p) return [];
      const same = await products.list({ categoryId: p.categoryId });
      return view(same.filter((o) => o.sellerId !== p.sellerId && o.slug !== p.slug).slice(0, limit));
    },

    async getSeller(id: string): Promise<SellerPage | null> {
      const s = await sellers.findById(id as SellerId);
      // A suspended shop has no public page.
      return s && !s.suspendedAt ? { seller: toSellerView(s), storefront: toStorefrontView(s) } : null;
    },

    /** Sellers with listings in a category, in the order their first listing appeared. */
    async sellersInCategory(category: string): Promise<SellerPage[]> {
      const ids = [...new Set((await products.list({ categoryId: category as CategoryId })).map((p) => p.sellerId))];
      const found = new Map((await sellers.findByIds(ids)).map((s) => [s.id, s]));
      return ids.flatMap((id) => {
        const s = found.get(id);
        return s && !s.suspendedAt ? [{ seller: toSellerView(s), storefront: toStorefrontView(s) }] : [];
      });
    },

    /** Records today's price of every live listing (hourly job; the day's last run wins). */
    recordPrices() {
      return products.recordPrices(clock.now().toISOString().slice(0, 10));
    },

    /** Current prices in cents, for price alerts. */
    currentPrices(slugs: readonly string[]) {
      return products.prices(slugs);
    },

    /** Recorded daily prices over the last `days`, in dollars, oldest first. */
    async priceHistory(slug: string, days = 90): Promise<{ date: string; price: number }[]> {
      const since = new Date(clock.now().getTime() - days * 86_400_000).toISOString().slice(0, 10);
      return (await products.priceHistory(slug, since)).map((p) => ({ date: p.day, price: p.price / 100 }));
    },

    /** Why a shop is suspended, or null when it isn't. */
    async suspension(id: string): Promise<{ at: string; reason: string } | null> {
      const s = await sellers.findById(id as SellerId);
      return s?.suspendedAt ? { at: s.suspendedAt.toISOString(), reason: s.suspendReason ?? "" } : null;
    },

    async listSellers(): Promise<SellerView[]> {
      return (await sellers.list()).filter((s) => !s.suspendedAt).map(toSellerView);
    },

    productSlugs: () => products.slugs(),
  };
}

export type CatalogQueries = ReturnType<typeof makeCatalogQueries>;
