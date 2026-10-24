import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Storefront } from "@/components/store/storefront";
// Factory towns are still editorial fixtures.
import { reviewSummary, towns } from "@/lib/catalog";
import { getProducts, getSellerPage, getSellers } from "@/server/catalog";
import { getSellerReviews, getSellerVideos } from "@/server/content";

export async function generateStaticParams() {
  return (await getSellers()).map((s) => ({ id: s.id }));
}

export async function generateMetadata({ params }: PageProps<"/s/[id]">): Promise<Metadata> {
  const { id } = await params;
  const page = await getSellerPage(id);
  return page ? { title: page.seller.name, description: page.storefront?.bio } : {};
}

export default function StorePage({ params }: PageProps<"/s/[id]">) {
  return (
    <Suspense fallback={<StoreSkeleton />}>
      <StoreBody params={params} />
    </Suspense>
  );
}

async function StoreBody({ params }: { params: PageProps<"/s/[id]">["params"] }) {
  const { id } = await params;
  const [page, listed, videos, reviews] = await Promise.all([getSellerPage(id), getProducts({ seller: id }), getSellerVideos(id), getSellerReviews(id)]);
  const seller = page?.seller;
  const profile = page?.storefront;
  if (!seller || !profile) notFound();
  const products = [...listed].sort((a, b) => (b.sold ?? b.reviews) - (a.sold ?? a.reviews));
  const title = (slug: string) => products.find((p) => p.slug === slug)?.title ?? "";
  const town = towns.find((t) => t.sellerIds.includes(id));
  // The store's summary blends its products' summaries, weighted by review count.
  const reviewCount = products.reduce((n, p) => n + p.reviews, 0);
  const parts = products.map((p) => reviewSummary(p));
  const summary = {
    stars: [0, 1, 2, 3, 4].map((i) => parts.reduce((n, s) => n + s.stars[i], 0)),
    // A new store with no listings or reviews yet has no aspect scores to blend.
    aspects:
      reviewCount === 0
        ? []
        : parts[0].aspects.map((a, i) => ({
            label: a.label,
            score: Math.round((parts.reduce((n, s, j) => n + s.aspects[i].score * products[j].reviews, 0) / reviewCount) * 10) / 10,
          })),
  };

  return (
    <Storefront
      seller={seller}
      profile={profile}
      products={products}
      videos={videos.map((v) => ({ ...v, productTitle: title(v.productSlug) }))}
      reviews={reviews.map((r) => ({ ...r, productTitle: title(r.productSlug) }))}
      reviewCount={reviewCount}
      summary={summary}
      town={town && { id: town.id, name: town.name, speciality: town.speciality }}
    />
  );
}

function StoreSkeleton() {
  return (
    <div className="mx-auto max-w-[1100px] lg:px-6 lg:pt-6">
      <div className="skeleton aspect-[16/9] max-h-[340px] lg:rounded-[32px]" />
      <div className="-mt-12 px-3.5 lg:px-6">
        <div className="skeleton size-[84px] rounded-[26px] ring-4 ring-canvas" />
        <div className="skeleton mt-4 h-8 w-56 rounded-xl" />
        <div className="skeleton mt-2 h-4 w-40 rounded-lg" />
        <div className="mt-4 grid grid-cols-4 gap-2">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className="skeleton h-14 rounded-2xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

