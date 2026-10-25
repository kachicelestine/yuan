"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { AgentOrb } from "@/components/ask/ask-screen";
import { Icon, VerifiedBadge } from "@/components/icon";
import { useMoney } from "@/components/price";
import { ProductCard } from "@/components/product/product-card";
import { useStore } from "@/components/providers";
import { Sheet, type Detent } from "@/components/sheet";
import { SponsoredCard, withSponsored } from "@/components/ads/sponsored";
import { useProductSearch, useSearchAll } from "./use-product-search";
import { brand } from "@/config/brand";
import { trendingSearches, understand, type CategoryId, type ProductFilters, type ProductSort } from "@/lib/catalog";
import { compact } from "@/lib/format";
import { capDensity } from "@/lib/images";
import { useStored } from "@/lib/use-stored";
import { Chip, FiltersSheet } from "./filters-sheet";
import { VisualSearch } from "./visual-search";
import { VoiceSearch } from "./voice-search";

type Tab = "products" | "videos" | "factories" | "live";

const sorts: { id: ProductSort; label: string }[] = [
  { id: "best", label: "Best match" },
  { id: "sold", label: "Best selling" },
  { id: "rating", label: "Top rated" },
  { id: "price-asc", label: "Price, low to high" },
  { id: "price-desc", label: "Price, high to low" },
];

const KIND_LABEL = { show: "Live shopping", tour: "Factory tour", auction: "Live auction" } as const;

type Category = { id: CategoryId; label: string; image: string };

/** Search everything: products with filters and sort, videos, factories and live rooms. */
export function SearchScreen({ categories, initialQuery = "", initialSnap = false, snapEnabled = false }: { categories: Category[]; initialQuery?: string; initialSnap?: boolean; snapEnabled?: boolean }) {
  const router = useRouter();
  const [query, setQuery] = useState(initialQuery);
  const [tab, setTab] = useState<Tab>("products");
  const [filters, setFilters] = useState<ProductFilters>({});
  const [sort, setSort] = useState<ProductSort>("best");
  const [sheet, setSheet] = useState<Detent>("closed");
  const [snap, setSnap] = useState(initialSnap && snapEnabled);
  const [voice, setVoice] = useState(false);
  const [recent, setRecent] = useStored<string[]>("app.recent-searches", []);
  const { markets, market } = useStore();
  const money = useMoney();

  const q = query.trim();
  // "power bank under 20 dollars": the price part becomes a filter, the rest is searched.
  const said = useMemo(() => understand(q), [q]);
  const toUsd = (a?: { amount: number; currency?: string }) =>
    a ? a.amount / (markets.find((m) => m.currency === (a.currency ?? market.currency))?.rate ?? market.rate) : undefined;
  const saidMax = toUsd(said.max);
  const saidMin = toUsd(said.min);
  const effective = useMemo(
    () => ({ ...filters, maxPrice: filters.maxPrice ?? saidMax, minPrice: filters.minPrice ?? saidMin }),
    [filters, saidMax, saidMin],
  );
  const terms = said.text;
  const filtered = Object.values(filters).some((v) => (Array.isArray(v) ? v.length : v !== undefined && v !== false));
  const searching = q !== "" || filtered;
  const { products, sponsored, loading } = useProductSearch(terms, effective, sort);
  const { videos, shops: factories, live, loading: finding } = useSearchAll(terms);
  const filterCount = Object.values(filters).reduce<number>((n, v) => n + (Array.isArray(v) ? v.length : v !== undefined && v !== false ? 1 : 0), 0);

  function run(text: string) {
    setQuery(text);
    const t = text.trim();
    router.replace(t ? `/search?q=${encodeURIComponent(t)}` : "/search", { scroll: false });
    if (t) setRecent([t, ...recent.filter((r) => r !== t)].slice(0, 8));
  }

  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "products", label: "Products", count: products.length },
    { id: "videos", label: "Videos", count: videos.length },
    { id: "factories", label: "Factories", count: factories.length },
    { id: "live", label: "Live", count: live.length },
  ];

  return (
    <div className="mx-auto min-h-dvh max-w-[1200px] pb-36 lg:pb-16">
      <div className="pt-safe sticky top-0 z-20 border-b border-line bg-canvas/75 px-3.5 pb-3 backdrop-blur-2xl lg:px-6 lg:pt-5">
        <form
          role="search"
          onSubmit={(e) => {
            e.preventDefault();
            run(query);
            (document.activeElement as HTMLElement | null)?.blur();
          }}
          className="flex items-center gap-2 pt-2 lg:pt-0"
        >
          <Link href="/" aria-label="Back" className="glass grid size-12 shrink-0 place-items-center rounded-full lg:hidden">
            <Icon name="back" className="size-5" />
          </Link>
          <label className="glass flex h-12 min-w-0 flex-1 items-center gap-2 rounded-full pr-1 pl-4">
            <Icon name="search" className="size-5 text-ink-2" />
            <span className="sr-only">Search products, videos and factories</span>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search anything made in China"
              enterKeyHint="search"
              autoComplete="off"
              className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-ink-3 [&::-webkit-search-cancel-button]:hidden"
            />
            {query && (
              <button type="button" onClick={() => run("")} aria-label="Clear search" className="grid size-10 place-items-center rounded-full text-ink-2">
                <Icon name="close" className="size-[18px]" />
              </button>
            )}
            <button type="button" onClick={() => setVoice(true)} aria-label="Search by voice" className="grid size-10 place-items-center rounded-full">
              <Icon name="mic" className="size-5" />
            </button>
            <button type="button" onClick={() => setSnap(true)} aria-label="Search with a photo" className={`grid size-10 place-items-center rounded-full ${snapEnabled ? "" : "hidden"}`}>
              <Icon name="camera" className="size-5" />
            </button>
          </label>
        </form>

        {searching && (
          <>
            <div role="tablist" aria-label="Result types" className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto">
              {tabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13.5px] font-semibold transition-colors ${tab === t.id ? "glass-selected text-ink" : "text-ink-2 hover:text-ink"}`}
                >
                  {t.label}
                  <span className="text-xs text-ink-3">{t.count}</span>
                </button>
              ))}
            </div>
            {tab === "products" && (
              <div className="no-scrollbar -mx-3.5 mt-2.5 flex gap-2 overflow-x-auto px-3.5 lg:mx-0 lg:px-0">
                <button
                  type="button"
                  onClick={() => setSheet("half")}
                  className={`flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold ${filterCount ? "bg-white text-black" : "glass-inset"}`}
                >
                  <Icon name="sparkle" className="size-4" />
                  Filters{filterCount ? ` · ${filterCount}` : ""}
                </button>
                <label className="glass-inset relative flex h-9 shrink-0 items-center gap-1 rounded-full pr-2.5 pl-3.5 text-[13px] font-semibold">
                  <span className="sr-only">Sort by</span>
                  {sorts.find((s) => s.id === sort)?.label}
                  <Icon name="down" className="size-3.5 text-ink-2" />
                  <select value={sort} onChange={(e) => setSort(e.target.value as ProductSort)} className="absolute inset-0 cursor-pointer opacity-0">
                    {sorts.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
                {(saidMax !== undefined || saidMin !== undefined) && (
                  <button
                    type="button"
                    onClick={() => run(terms)}
                    aria-label="Remove the price from your search"
                    className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-agent/20 px-3.5 text-[13px] font-semibold text-agent"
                  >
                    <Icon name="sparkle" className="size-3.5" />
                    {saidMin !== undefined && saidMax !== undefined
                      ? `${money(saidMin)}–${money(saidMax)}`
                      : saidMax !== undefined
                        ? `Under ${money(saidMax)}`
                        : `Over ${money(saidMin ?? 0)}`}
                    <Icon name="close" className="size-3.5" />
                  </button>
                )}
                <Chip on={!!filters.onSale} onClick={() => setFilters({ ...filters, onSale: !filters.onSale })}>
                  On sale
                </Chip>
                <Chip on={!!filters.bulk} onClick={() => setFilters({ ...filters, bulk: !filters.bulk })}>
                  Bulk pricing
                </Chip>
                <Chip on={!!filters.verified} onClick={() => setFilters({ ...filters, verified: !filters.verified })}>
                  Audited factory
                </Chip>
                <Chip on={!!filters.fast} onClick={() => setFilters({ ...filters, fast: !filters.fast })}>
                  Arrives in 10 days
                </Chip>
              </div>
            )}
          </>
        )}
      </div>

      <div className="px-3.5 pt-4 lg:px-6">
        {!searching ? (
          <Landing categories={categories} recent={recent} onClearRecent={() => setRecent([])} onPick={run} onSnap={snapEnabled ? () => setSnap(true) : null} />
        ) : tab === "products" ? (
          products.length ? (
            <ul
              aria-label={`${products.length} products`}
              aria-busy={loading}
              className={`grid grid-cols-2 gap-2.5 transition-opacity duration-200 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 ${loading ? "opacity-60" : ""}`}
            >
              {withSponsored(products, sponsored).map((r, i) =>
                r.kind === "sponsored" ? (
                  <li key={`ad-${r.item.product.slug}`}>
                    <SponsoredCard item={r.item} eager={i < 4} sizes="(min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw" />
                  </li>
                ) : (
                  <li key={r.product.slug}>
                    <ProductCard product={r.product} eager={i < 4} sizes="(min-width: 1280px) 20vw, (min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw" />
                  </li>
                ),
              )}
            </ul>
          ) : loading ? (
            <ul aria-busy="true" aria-label="Searching" className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {Array.from({ length: 8 }, (_, i) => (
                <li key={i} className="skeleton aspect-[3/4] rounded-[22px]" />
              ))}
            </ul>
          ) : (
            <NoResults query={q} onPick={run} />
          )
        ) : finding && !(tab === "videos" ? videos : tab === "factories" ? factories : live).length ? (
          <ul aria-busy="true" aria-label="Searching" className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 4 }, (_, i) => (
              <li key={i} className={`skeleton rounded-[22px] ${tab === "videos" ? "aspect-[9/16]" : "aspect-[4/3]"}`} />
            ))}
          </ul>
        ) : tab === "videos" ? (
          videos.length ? (
            <ul aria-busy={finding} className={`grid grid-cols-2 gap-2.5 transition-opacity sm:grid-cols-3 lg:grid-cols-5 ${finding ? "opacity-60" : ""}`}>
              {videos.map((v) => (
                <li key={v.id}>
                  <Link href={`/?v=${v.id}`} data-tone={v.tone} className="relative block aspect-[9/16] overflow-hidden rounded-[22px] bg-surface">
                    <Image src={v.image} alt="" fill sizes={capDensity("(min-width: 1024px) 20vw, 50vw")} className="object-cover" />
                    <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    <span className="absolute top-2 left-2 flex items-center gap-1 text-xs font-bold text-legible">
                      <Icon name="play" filled className="size-3.5" />
                      {compact(v.views || v.likes)}
                    </span>
                    <span className="absolute inset-x-2.5 bottom-2.5 text-legible">
                      <span className="line-clamp-2 text-[13px] leading-snug font-semibold">{v.title}</span>
                      {v.sellerName && <span className="mt-0.5 block truncate text-[11px] font-semibold text-white/75">{v.sellerName}</span>}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <NoResults query={q} onPick={run} />
          )
        ) : tab === "factories" ? (
          factories.length ? (
            <ul aria-busy={finding} className={`grid gap-2.5 transition-opacity lg:grid-cols-2 ${finding ? "opacity-60" : ""}`}>
              {factories.map((s) => (
                <li key={s.id}>
                  <Link href={`/s/${s.id}`} className="glass flex items-center gap-3 rounded-[24px] p-3">
                    <Image src={s.avatar} alt="" width={52} height={52} sizes="52px" className="size-[52px] shrink-0 rounded-2xl object-cover" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-[15px] font-semibold">
                        <span className="truncate">{s.name}</span>
                        {s.verified && <VerifiedBadge />}
                      </span>
                      <span className="block truncate text-xs text-ink-2">
                        <span className="capitalize">{s.kind}</span> · {s.city}
                        {s.matching > 0 && ` · ${s.matching} matching`}
                      </span>
                      <span className="mt-1 flex items-center gap-2 text-[11px] text-ink-2">
                        {s.rating > 0 && (
                          <span className="flex items-center gap-0.5">
                            <Icon name="star" filled className="size-3 text-save" />
                            {s.rating}
                          </span>
                        )}
                        {s.followers > 0 && <span>{compact(s.followers)} followers</span>}
                        {s.responseHours !== null && <span>Replies in {s.responseHours} h</span>}
                      </span>
                    </span>
                    <span className="hidden gap-1.5 sm:flex">
                      {s.preview.map((src) => (
                        <Image key={src} src={src} alt="" width={48} height={48} sizes="48px" className="size-12 rounded-xl object-cover" />
                      ))}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <NoResults query={q} onPick={run} />
          )
        ) : (
          <ul aria-busy={finding} className={`grid gap-2.5 transition-opacity sm:grid-cols-2 ${finding ? "opacity-60" : ""}`}>
            {live.map((r) => (
              <li key={r.id}>
                <Link href={`/live/${r.id}`} className="relative block aspect-[4/5] overflow-hidden rounded-[26px] sm:aspect-[4/3]">
                  <Image src={r.coverUrl} alt="" fill sizes={capDensity("(min-width: 640px) 50vw, 100vw")} className="object-cover" />
                  <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-black/30" />
                  <span className="absolute top-3 left-3 flex items-center gap-2">
                    {r.status === "live" ? (
                      <span className="flex h-6 items-center gap-1.5 rounded-full bg-live px-2 text-[10.5px] font-extrabold tracking-[0.08em]">
                        <span className="size-1.5 rounded-full bg-white" />
                        LIVE
                      </span>
                    ) : (
                      <span className="glass flex h-6 items-center gap-1 rounded-full px-2 text-[11px] font-semibold">
                        <Icon name="clock" className="size-3.5" />
                        {new Date(r.scheduledFor).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })}
                      </span>
                    )}
                    {r.status === "live" && r.peakViewers > 0 && (
                      <span className="glass flex h-6 items-center gap-1 rounded-full px-2 text-[11px] font-semibold">
                        <Icon name="eye" className="size-3.5" />
                        {compact(r.peakViewers)}
                      </span>
                    )}
                  </span>
                  <span className="absolute inset-x-3.5 bottom-3.5">
                    <span className="block text-xs font-semibold text-white/80">
                      {KIND_LABEL[r.kind]} · {r.hostName}
                      {r.sellerName && `, ${r.sellerName}`}
                    </span>
                    <span className="block font-display text-xl font-bold text-legible">{r.title}</span>
                  </span>
                </Link>
              </li>
            ))}
            {!live.length && <NoResults query={q} onPick={run} />}
          </ul>
        )}
      </div>

      <Sheet detent={sheet} onDetent={setSheet} label="Filters">
        <FiltersSheet filters={filters} onChange={setFilters} categories={categories} count={products.length} onDone={() => setSheet("closed")} />
      </Sheet>
      {snap && <VisualSearch open onClose={() => setSnap(false)} />}
      {voice && <VoiceSearch open onClose={() => setVoice(false)} onResult={run} />}
    </div>
  );
}

function Landing({
  categories,
  recent,
  onClearRecent,
  onPick,
  onSnap,
}: {
  categories: Category[];
  recent: string[];
  onClearRecent: () => void;
  onPick: (q: string) => void;
  onSnap: (() => void) | null;
}) {
  return (
    <div className="flex flex-col gap-6">
      {onSnap && (
      <button type="button" onClick={onSnap} className="glass relative flex items-center gap-4 overflow-hidden rounded-[28px] p-4 text-left">
        <span className="glass glass-prominent grid size-14 shrink-0 place-items-center rounded-full">
          <Icon name="camera" className="size-7" />
        </span>
        <span className="flex-1">
          <span className="block font-display text-lg font-bold">Snap to search</span>
          <span className="block text-[13px] text-ink-2">Point your camera at something and find it in the catalog.</span>
        </span>
        <Icon name="forward" className="size-5 text-ink-2" />
      </button>
      )}

      <Link href="/ask" className={`glass relative flex ${onSnap ? "-mt-3" : ""} items-center gap-4 overflow-hidden rounded-[28px] p-4`}>
        <AgentOrb className="size-14 shrink-0" />
        <span className="flex-1">
          <span className="block font-display text-lg font-bold">Ask {brand.name}</span>
          <span className="block text-[13px] text-ink-2">Describe what you need. The assistant finds, compares and prices it to your door.</span>
        </span>
        <Icon name="forward" className="size-5 text-ink-2" />
      </Link>

      {recent.length > 0 && (
        <section aria-labelledby="recent-h">
          <div className="mb-2 flex items-center justify-between">
            <h2 id="recent-h" className="text-[15px] font-bold">
              Recent
            </h2>
            <button type="button" onClick={onClearRecent} className="text-[13px] font-semibold text-ink-2">
              Clear
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {recent.map((r) => (
              <button key={r} type="button" onClick={() => onPick(r)} className="glass-inset flex h-9 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold">
                <Icon name="clock" className="size-3.5 text-ink-2" />
                {r}
              </button>
            ))}
          </div>
        </section>
      )}

      <section aria-labelledby="trending-h">
        <h2 id="trending-h" className="mb-2 text-[15px] font-bold">
          Ideas to search
        </h2>
        <ul className="grid grid-cols-1 gap-x-6 sm:grid-cols-2">
          {trendingSearches.map((t) => (
            <li key={t}>
              <button type="button" onClick={() => onPick(t)} className="flex h-12 w-full items-center gap-3 border-b border-line text-left text-[15px]">
                <Icon name="search" className="size-4 text-ink-3" />
                <span className="flex-1">{t}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="cats-h">
        <h2 id="cats-h" className="mb-3 text-[15px] font-bold">
          Browse everything
        </h2>
        <ul className="grid grid-cols-4 gap-x-2 gap-y-4 sm:grid-cols-6 lg:grid-cols-12">
          {categories.map((c) => (
            <li key={c.id}>
              <Link href={`/c/${c.id}`} className="flex flex-col items-center gap-1.5 text-center">
                <span className="relative size-16 overflow-hidden rounded-full ring-1 ring-white/15">
                  <Image src={c.image} alt="" fill sizes="64px" className="object-cover" />
                </span>
                <span className="text-[11.5px] leading-tight font-semibold text-ink-2">{c.label}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function NoResults({ query, onPick }: { query: string; onPick: (q: string) => void }) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center gap-3 py-12 text-center">
      <span className="glass grid size-16 place-items-center rounded-full">
        <Icon name="search" className="size-7" />
      </span>
      <h2 className="font-display text-xl font-bold">Nothing matches “{query}” yet</h2>
      <p className="text-sm text-ink-2">Shops often make things they don&apos;t list. Ask them for a quote, or try one of these.</p>
      <Link href="/business" className="flex h-11 items-center gap-2 rounded-full bg-accent px-5 text-[15px] font-bold">
        <Icon name="factory" className="size-4" />
        Ask shops to quote it
      </Link>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        {trendingSearches.slice(0, 4).map((t) => (
          <button key={t} type="button" onClick={() => onPick(t)} className="glass-inset h-9 rounded-full px-3.5 text-[13px] font-semibold">
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}

