import { Feed } from "@/components/feed/feed";
import type { FeedItem } from "@/components/feed/feed-slide";
// Videos still come from fixtures until the content module lands; products and sellers are live.
import { videos } from "@/lib/catalog";
import { getCategories, getProducts, getSellers } from "@/server/catalog";

export default async function ForYouPage() {
  const [products, sellers, categories] = await Promise.all([getProducts(), getSellers(), getCategories()]);
  const productBySlug = new Map(products.map((p) => [p.slug, p]));
  const sellerById = new Map(sellers.map((s) => [s.id, s]));

  const items: FeedItem[] = videos.flatMap((video) => {
    const product = productBySlug.get(video.productSlug);
    const seller = sellerById.get(video.sellerId);
    if (!product || !seller) return [];
    const related = {
      fromSeller: products.filter((p) => p.sellerId === seller.id && p.slug !== product.slug).slice(0, 6),
      similar: products.filter((p) => p.category === product.category && p.sellerId !== product.sellerId).slice(0, 4),
      category: categories.find((c) => c.id === product.category)?.label ?? "",
    };
    const look = [product, ...(video.also ?? []).flatMap((slug) => productBySlug.get(slug) ?? [])];
    return [{ video, product, seller, related, look }];
  });

  return <Feed items={items} />;
}
