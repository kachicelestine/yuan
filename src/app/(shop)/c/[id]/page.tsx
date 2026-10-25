import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { CategoryShelf } from "@/components/category/category-shelf";
import { Icon, VerifiedBadge } from "@/components/icon";
import { compact, plural } from "@/lib/format";
import { getCategories, getCategory, getProducts, getSellersInCategory } from "@/server/catalog";
import { getCategoryVideos, getNotes } from "@/server/content";

export async function generateStaticParams() {
  return (await getCategories()).map((c) => ({ id: c.id }));
}

export async function generateMetadata({ params }: PageProps<"/c/[id]">): Promise<Metadata> {
  const { id } = await params;
  const category = await getCategory(id);
  return category ? { title: category.label, description: category.blurb } : {};
}

// The id comes from the URL, so the body streams in behind a skeleton and the shell stays instant.
export default function CategoryPage({ params }: PageProps<"/c/[id]">) {
  return (
    <Suspense fallback={<CategorySkeleton />}>
      <CategoryBody params={params} />
    </Suspense>
  );
}

async function CategoryBody({ params }: { params: PageProps<"/c/[id]">["params"] }) {
  const { id } = await params;
  const category = await getCategory(id);
  if (!category) notFound();
  const [items, factories, videos, notes] = await Promise.all([
    getProducts({ category: category.id }),
    getSellersInCategory(category.id),
    getCategoryVideos(category.id),
    getNotes(category.id),
  ]);

  return (
    <div className="mx-auto max-w-[1200px] pb-36 lg:px-6 lg:pt-6 lg:pb-16">
      <header data-tone="dark" className="relative h-[44vh] min-h-[300px] overflow-hidden lg:h-[360px] lg:rounded-[32px]">
        <Image src={category.hero} alt="" fill loading="eager" sizes="(min-width: 1200px) 1150px, 100vw" className="object-cover" />
        <span className="absolute inset-0 bg-gradient-to-t from-canvas via-black/20 to-black/40" />
        <div className="pt-safe absolute inset-x-0 top-0 flex items-center justify-between px-3.5 lg:hidden">
          <Link href="/c" aria-label="All categories" className="glass grid size-12 place-items-center rounded-full">
            <Icon name="back" className="size-5" />
          </Link>
          <Link href="/search" aria-label="Search" className="glass grid size-12 place-items-center rounded-full">
            <Icon name="search" />
          </Link>
        </div>
        <div className="absolute inset-x-3.5 bottom-4 lg:inset-x-8 lg:bottom-7">
          <p className="text-xs font-bold tracking-[0.1em] text-white/70 uppercase">
            {plural(items.length, "product")} · {plural(factories.length, "seller")}
          </p>
          <h1 className="font-display text-[40px] leading-[1.05] font-extrabold tracking-[-0.03em] text-legible lg:text-[52px]">{category.label}</h1>
          <p className="mt-1.5 max-w-xl text-[15px] leading-snug text-white/85 text-legible">{category.blurb}</p>
        </div>
      </header>

      <div className="flex flex-col gap-9 px-3.5 pt-5 lg:px-0">
        {category.id === "energy" && (
          <Link href="/energy" className="glass -mb-4 flex items-center gap-3.5 rounded-[26px] p-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-save/15 text-save">
              <Icon name="sun" />
            </span>
            <span className="min-w-0 flex-1">
              <b className="block text-[15px] font-semibold">Size a solar kit from your bill</b>
              <span className="block text-[13px] text-ink-2">Panels, inverter and battery picked for you, with payback and CO₂ saved.</span>
            </span>
            <Icon name="forward" className="size-4 text-ink-3" />
          </Link>
        )}
        <CategoryShelf category={category.id} items={items} subcategories={category.subcategories} />

        {factories.length > 0 && (
          <section aria-labelledby="factories-h">
            <h2 id="factories-h" className="mb-3 font-display text-xl font-bold">
              Top sellers
            </h2>
            <ul className="no-scrollbar -mx-3.5 flex gap-3 overflow-x-auto px-3.5 lg:mx-0 lg:grid lg:grid-cols-3 lg:px-0">
              {factories.map(({ seller: s, storefront: profile }) => {
                return (
                  <li key={s.id} className="w-[260px] shrink-0 lg:w-auto">
                    <Link href={`/s/${s.id}`} className="glass block overflow-hidden rounded-[24px]">
                      <span className="relative block aspect-[16/7]">{profile && <Image src={profile.cover} alt="" fill sizes="300px" className="object-cover" />}</span>
                      <span className="flex items-center gap-2.5 p-3">
                        <Image src={s.avatar} alt="" width={40} height={40} sizes="40px" className="-mt-8 size-10 rounded-xl object-cover ring-2 ring-surface" />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-1 text-sm font-semibold">
                            <span className="truncate">{s.name}</span>
                            {s.verified && <VerifiedBadge className="size-3.5" />}
                          </span>
                          {profile && (
                            <span className="block text-[11px] text-ink-2">
                              ★ {profile.rating} · {compact(profile.followers)} followers · {s.city}
                            </span>
                          )}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {videos.length > 0 && (
          <section aria-labelledby="videos-h">
            <h2 id="videos-h" className="mb-3 font-display text-xl font-bold">
              Watch and shop
            </h2>
            <ul className="no-scrollbar -mx-3.5 flex gap-2.5 overflow-x-auto px-3.5 lg:mx-0 lg:px-0">
              {videos.map((v) => (
                <li key={v.id} className="w-[150px] shrink-0">
                  <Link href={`/?v=${v.id}`} className="relative block aspect-[9/16] overflow-hidden rounded-[20px] bg-surface">
                    <Image src={v.image} alt="" fill sizes="150px" className="object-cover" />
                    <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    <span className="absolute top-2 left-2 flex items-center gap-1 text-[11px] font-bold text-legible">
                      <Icon name="play" filled className="size-3" />
                      {compact(v.likes)}
                    </span>
                    <span className="absolute inset-x-2 bottom-2 line-clamp-2 text-xs leading-snug font-semibold text-legible">{items.find((p) => p.slug === v.productSlug)?.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        {notes.length > 0 && (
          <section aria-labelledby="notes-h">
            <h2 id="notes-h" className="mb-3 font-display text-xl font-bold">
              From the community
            </h2>
            <ul className="no-scrollbar -mx-3.5 flex gap-2.5 overflow-x-auto px-3.5 lg:mx-0 lg:px-0">
              {notes.map((n) => (
                <li key={n.id} className="w-[200px] shrink-0">
                  <Link href={n.productSlug ? `/p/${n.productSlug}` : "/discover"} className="block overflow-hidden rounded-[18px] bg-surface ring-[0.5px] ring-white/10">
                    <span className="relative block aspect-[3/4]">
                      <Image src={n.image} alt="" fill sizes="200px" className="object-cover" />
                    </span>
                    <span className="line-clamp-2 px-2.5 pt-2 text-[13px] leading-snug font-semibold">{n.title}</span>
                    <span className="flex items-center gap-1.5 px-2.5 pt-1.5 pb-2.5 text-xs text-ink-2">
                      <Image src={n.authorAvatar} alt="" width={18} height={18} sizes="18px" className="size-[18px] rounded-full object-cover" />
                      <span className="truncate">{n.authorName}</span>
                      <span className="ml-auto flex items-center gap-0.5">
                        <Icon name="heart" className="size-3.5" />
                        {compact(n.likes)}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

function CategorySkeleton() {
  return (
    <div className="mx-auto max-w-[1200px] pb-36 lg:px-6 lg:pt-6">
      <div className="skeleton h-[44vh] min-h-[300px] lg:h-[360px] lg:rounded-[32px]" />
      <div className="mt-5 flex gap-2 px-3.5 lg:px-0">
        {[64, 92, 80, 70].map((w) => (
          <span key={w} className="skeleton h-9 rounded-full" style={{ width: w }} />
        ))}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2.5 px-3.5 sm:grid-cols-3 lg:grid-cols-4 lg:px-0">
        {Array.from({ length: 4 }, (_, i) => (
          <span key={i} className="skeleton aspect-[3/4] rounded-[22px]" />
        ))}
      </div>
    </div>
  );
}

