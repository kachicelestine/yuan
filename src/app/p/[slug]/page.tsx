import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Icon, VerifiedBadge } from "@/components/icon";
import { BagButton } from "@/components/product/bag-button";
import { BuyBox } from "@/components/product/buy-box";
import { Gallery } from "@/components/product/gallery";
import { PriceHistory } from "@/components/product/price-history";
import { ProductCard } from "@/components/product/product-card";
import { ProductTile } from "@/components/product/product-tile";
import { Questions } from "@/components/product/questions";
import { RatingSummary, ReviewList } from "@/components/reviews/reviews";
import { ShareButton } from "@/components/share/share-sheet";
import { CompareButton } from "@/components/compare/compare";
import { GiftButton } from "@/components/gift/gift-sheet";
// Reviews and Q&A still come from fixtures until the content module lands.
import { questionsFor, reviewSummary, reviewsFor } from "@/lib/catalog";
import { getCategory, getProduct, getProductSlugs, getProducts, getSellerPage, getSimilarProducts } from "@/server/catalog";

export async function generateStaticParams() {
  return (await getProductSlugs()).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: PageProps<"/p/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  return product ? { title: product.title, description: product.highlights.join(" · ") } : {};
}

// Everything on this page depends on the slug in the URL, so it streams in behind a
// skeleton; the shell stays instant to navigate to.
export default function ProductPage({ params }: PageProps<"/p/[slug]">) {
  return (
    <Suspense fallback={<ProductSkeleton />}>
      <ProductBody params={params} />
    </Suspense>
  );
}

async function ProductBody({ params }: { params: PageProps<"/p/[slug]">["params"] }) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();
  const [page, category, sellerProducts, similar] = await Promise.all([
    getSellerPage(product.sellerId),
    getCategory(product.category),
    getProducts({ seller: product.sellerId }),
    getSimilarProducts(product.slug, 8),
  ]);
  const seller = page?.seller;
  const profile = page?.storefront;
  const more = sellerProducts.filter((p) => p.slug !== product.slug).slice(0, 4);
  const reviews = reviewsFor(product.slug);
  const questions = questionsFor(product.slug);

  return (
    <div className="pb-36 lg:pb-16">
      <header className="pt-safe pointer-events-none fixed inset-x-0 top-0 z-30 flex items-center justify-between px-3.5 lg:sticky lg:border-b lg:border-line lg:bg-canvas/60 lg:py-3 lg:backdrop-blur-2xl">
        <Link href="/" aria-label="Back to feed" className="glass pointer-events-auto grid size-11 place-items-center rounded-full">
          <Icon name="back" className="size-5" />
        </Link>
        <nav aria-label="Breadcrumb" className="hidden items-center gap-2 text-[13px] text-ink-2 lg:flex">
          <Link href="/c" className="hover:text-ink">
            Everything
          </Link>
          <span>/</span>
          {category && (
            <>
              <Link href={`/c/${category.id}`} className="hover:text-ink">
                {category.label}
              </Link>
              <span>/</span>
            </>
          )}
          <span className="text-ink">{product.title}</span>
        </nav>
        <div className="pointer-events-auto flex gap-2">
          <CompareButton product={product} className="glass grid size-11 place-items-center rounded-full" />
          <ShareButton product={product} className="glass grid size-11 place-items-center rounded-full" />
          <BagButton />
        </div>
      </header>

      <div className="mx-auto max-w-[1360px] lg:px-6 lg:pt-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
          <div className="min-w-0 lg:flex-[999_1_560px]">
            <Gallery images={product.images} title={product.title} />
          </div>

          <section aria-label="Buy" className="glass-sheet flex flex-col gap-4 rounded-t-[34px] px-4 pt-5 pb-6 lg:sticky lg:top-[92px] lg:max-w-[520px] lg:flex-[1_1_400px] lg:rounded-[32px] lg:p-6">
            {seller && (
              <Link href={`/s/${seller.id}`} className="flex items-center gap-2 text-[13px] text-ink-2">
                <Image src={seller.avatar} alt="" width={24} height={24} sizes="24px" className="size-6 rounded-full object-cover" />
                <b className="text-ink">{seller.name}</b>
                {seller.verified && <VerifiedBadge />}
                <span className="truncate">
                  · {seller.kind} · {seller.city}
                </span>
                <Icon name="forward" className="ml-auto size-4 shrink-0" />
              </Link>
            )}
            <h1 className="font-display text-[26px] leading-[1.1] font-extrabold tracking-[-0.02em] text-balance lg:text-[32px]">{product.title}</h1>
            <p className="flex items-center gap-1.5 text-sm text-ink-2">
              <Icon name="star" filled className="size-4 text-save" />
              <b className="text-ink">{product.rating}</b> ·{" "}
              <a href="#reviews" className="underline decoration-white/25 underline-offset-2">
                {product.reviews.toLocaleString("en-US")} reviews
              </a>
              {product.sold && <> · {product.sold.toLocaleString("en-US")} sold</>}
            </p>
            <ul className="flex flex-wrap gap-1.5">
              {product.highlights.map((h) => (
                <li key={h} className="rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold ring-[0.5px] ring-white/20 ring-inset">
                  {h}
                </li>
              ))}
            </ul>
            {product.buyersSay && (
              <p className="glass-inset flex gap-2.5 rounded-[18px] p-3.5 text-sm leading-relaxed text-ink-2">
                <Icon name="sparkle" className="mt-0.5 size-5 text-agent" />
                {product.buyersSay}
              </p>
            )}
            {product.category === "toys" && (
              <Link href="/unbox" className="glass-inset flex items-center gap-3 rounded-[20px] p-3.5">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-accent-light/15 text-accent-light">
                  <Icon name="cube" className="size-5" />
                </span>
                <span className="min-w-0 flex-1 text-sm">
                  <b className="block font-semibold">Pick your box from a real case</b>
                  <span className="text-xs text-ink-2">Shake for hints, see the odds, open it on screen.</span>
                </span>
                <Icon name="forward" className="size-4 text-ink-3" />
              </Link>
            )}
            <BuyBox product={product} />
            <GiftButton product={product} />
          </section>
        </div>

        <div className="mt-10 grid gap-10 px-4 lg:grid-cols-2 lg:gap-8 lg:px-0">
          <div className="flex flex-col gap-10">
            <section aria-labelledby="specs">
              <h2 id="specs" className="mb-4 font-display text-2xl font-extrabold tracking-[-0.03em]">
                Specifications
              </h2>
              <dl className="glass-inset rounded-[26px] px-5">
                {product.specs.map(([k, v]) => (
                  <div key={k} className="flex justify-between gap-4 border-b border-line py-3.5 text-[15px] last:border-0">
                    <dt className="text-ink-2">{k}</dt>
                    <dd className="text-right font-semibold">{v}</dd>
                  </div>
                ))}
              </dl>
            </section>
            {product.price !== undefined && <PriceHistory product={product} />}
            {seller && <Questions questions={questions} sellerName={seller.name} replyHours={profile?.responseHours ?? 4} />}
          </div>

          <div className="flex flex-col gap-10">
            <section id="reviews" aria-labelledby="reviews-h" className="scroll-mt-24">
              <h2 id="reviews-h" className="mb-4 font-display text-2xl font-extrabold tracking-[-0.03em]">
                Reviews
              </h2>
              <RatingSummary rating={product.rating} count={product.reviews} summary={reviewSummary(product)} />
              <div className="mt-3">
                {reviews.length > 0 ? (
                  <ReviewList reviews={reviews} />
                ) : (
                  <p className="glass-inset rounded-[22px] p-4 text-sm text-ink-2">Written reviews for this product are on their way. The scores above come from verified orders.</p>
                )}
              </div>
            </section>

            {seller && (
              <section aria-labelledby="seller">
                <h2 id="seller" className="mb-4 font-display text-2xl font-extrabold tracking-[-0.03em]">
                  Sold by {seller.name}
                </h2>
                <Link href={`/s/${seller.id}`} className="glass-inset flex items-center gap-4 rounded-[26px] p-4">
                  <Image src={seller.avatar} alt="" width={56} height={56} sizes="56px" className="size-14 rounded-2xl object-cover" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 font-semibold">
                      {seller.name}
                      {seller.verified && <VerifiedBadge />}
                    </p>
                    <p className="text-[13px] text-ink-2">
                      {seller.kind} in {seller.city}
                      {seller.years && <> · {seller.years} years making</>}
                      {seller.audited && <> · audited on site {seller.audited}</>}
                    </p>
                  </div>
                  <Icon name="forward" className="size-5 text-ink-2" />
                </Link>
                {more.length > 0 && (
                  <ul className="mt-4 grid grid-cols-2 gap-3">
                    {more.map((p) => (
                      <li key={p.slug}>
                        <ProductTile product={p} sizes="(min-width: 1024px) 300px, 50vw" />
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}
          </div>
        </div>

        {similar.length > 0 && (
          <section aria-labelledby="similar" className="mt-12 px-4 lg:px-0">
            <h2 id="similar" className="mb-4 font-display text-2xl font-extrabold tracking-[-0.03em]">
              Similar from other factories
            </h2>
            <ul className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4 lg:mx-0 lg:grid lg:grid-cols-5 lg:px-0">
              {similar.map((p) => (
                <li key={p.slug} className="w-[168px] shrink-0 lg:w-auto">
                  <ProductCard product={p} sizes="(min-width: 1024px) 20vw, 168px" />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

function ProductSkeleton() {
  return (
    <div className="mx-auto max-w-[1360px] lg:px-6 lg:pt-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
        <div className="skeleton aspect-square lg:aspect-[4/3] lg:flex-[999_1_560px] lg:rounded-[30px]" />
        <div className="flex flex-col gap-3 px-4 lg:flex-[1_1_400px] lg:px-0">
          <div className="skeleton h-4 w-40 rounded-lg" />
          <div className="skeleton h-8 w-4/5 rounded-xl" />
          <div className="skeleton h-4 w-56 rounded-lg" />
          <div className="skeleton mt-2 h-32 rounded-[22px]" />
          <div className="skeleton h-12 rounded-full" />
        </div>
      </div>
    </div>
  );
}

