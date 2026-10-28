"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Icon, VerifiedBadge } from "@/components/icon";
import { Flag } from "@/components/market/flag";
import { ProductCard } from "@/components/product/product-card";
import { useStore } from "@/components/providers";
import { RatingSummary, ReviewList } from "@/components/reviews/reviews";
import { SellerCouponChip } from "@/components/rewards/coupon-wallet";
import { brand } from "@/config/brand";
import type { Product, Review, ReviewSummary, Seller, SellerProfile, Video } from "@/lib/catalog";
import { compact } from "@/lib/format";
import { capDensity } from "@/lib/images";
import { useStored } from "@/lib/use-stored";

type Tab = "products" | "videos" | "reviews" | "factory";

type Props = {
  seller: Seller;
  profile: SellerProfile;
  products: Product[];
  videos: (Video & { productTitle: string })[];
  reviews: (Review & { productTitle: string })[];
  reviewCount: number;
  summary: ReviewSummary;
  town?: { id: string; name: string; speciality: string };
};

/** A seller's storefront: who they are, why to trust them, and everything they sell. */
export function Storefront({ seller, profile, products, videos, reviews, reviewCount, summary, town }: Props) {
  const { market } = useStore();
  const [tab, setTab] = useState<Tab>("products");
  const [following, setFollowing] = useStored<string[]>("app.following", []);
  const followed = following.includes(seller.id);
  const shipsHere = profile.exportsTo.includes(market.code);

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "products", label: "Products", count: products.length },
    { id: "videos", label: "Videos", count: videos.length },
    { id: "reviews", label: "Reviews", count: reviewCount },
    { id: "factory", label: seller.kind === "Factory" ? "Factory" : "About" },
  ];

  return (
    <div className="mx-auto max-w-[1100px] pb-36 lg:px-6 lg:pt-6 lg:pb-16">
      <div data-tone="dark" className="relative aspect-[16/9] max-h-[340px] w-full overflow-hidden lg:rounded-[32px]">
        <Image src={profile.cover} alt="" fill loading="eager" fetchPriority="high" sizes="(min-width: 1100px) 1050px, 100vw" className="object-cover" />
        <span className="absolute inset-0 bg-gradient-to-t from-canvas via-transparent to-black/40" />
        <div className="pt-safe absolute inset-x-0 top-0 flex items-center justify-between px-3.5 lg:hidden">
          <Link href="/search" aria-label="Back" className="glass grid size-12 place-items-center rounded-full">
            <Icon name="back" className="size-5" />
          </Link>
          <button type="button" aria-label="Share this store" className="glass grid size-12 place-items-center rounded-full">
            <Icon name="share" className="size-5" />
          </button>
        </div>
      </div>

      <div className="relative -mt-12 px-3.5 lg:px-6">
        <div className="flex items-end gap-3">
          <Image src={seller.avatar} alt="" width={84} height={84} sizes="84px" loading="eager" className="size-[84px] rounded-[26px] object-cover shadow-[0_10px_30px_rgb(0_0_0/0.4)] ring-4 ring-canvas" />
          <div className="ml-auto flex gap-2 pb-1">
            <button
              type="button"
              onClick={() => setFollowing(followed ? following.filter((id) => id !== seller.id) : [...following, seller.id])}
              className={`h-11 rounded-full px-5 text-[15px] font-bold transition-colors ${followed ? "glass text-ink-2" : "bg-accent"}`}
            >
              {followed ? "Following" : "Follow"}
            </button>
            <Link href={`/inbox/${seller.id}`} className="glass flex h-11 items-center gap-1.5 rounded-full px-4 text-[15px] font-semibold">
              <Icon name="chat" className="size-[18px]" />
              Message
            </Link>
          </div>
        </div>
        <h1 className="mt-3 flex items-center gap-2 font-display text-[28px] leading-tight font-extrabold tracking-[-0.025em]">
          {seller.name}
          {seller.verified && <VerifiedBadge className="size-6" />}
        </h1>
        <p className="text-sm text-ink-2">
          {seller.kind} · {seller.city}
          {seller.years ? ` · ${seller.years} years` : ""}
          {town && (
            <>
              {" · "}
              <Link href={`/search?q=${encodeURIComponent(town.name)}`} className="font-semibold text-ink underline decoration-white/30 underline-offset-2">
                {town.name} factory town
              </Link>
            </>
          )}
        </p>
        <p className="mt-2 max-w-2xl text-[15px] leading-relaxed">{profile.bio}</p>

        <dl className="mt-4 grid grid-cols-4 gap-2">
          {[
            ["Rating", `★ ${profile.rating}`],
            ["Followers", compact(profile.followers)],
            ["Replies", `in ${profile.responseHours} h`],
            ["On time", `${Math.round(profile.onTime * 100)}%`],
          ].map(([label, value]) => (
            <div key={label} className="glass-inset flex flex-col items-center rounded-2xl py-2.5">
              <dd className="font-display text-[17px] font-bold">{value}</dd>
              <dt className="text-[11px] text-ink-3">{label}</dt>
            </div>
          ))}
        </dl>

        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <p className="glass-inset flex flex-1 items-center gap-2.5 rounded-2xl px-3.5 py-3 text-[13px]">
            <Icon name="shield" className="size-5 text-positive" />
            <span>
              <b className="font-semibold">{seller.audited ? `Audited on site, ${seller.audited}` : "Verified business"}</b>
              <span className="text-ink-2"> · {brand.name} Protect on every order</span>
            </span>
          </p>
          <p className="glass-inset flex flex-1 items-center gap-2.5 rounded-2xl px-3.5 py-3 text-[13px]">
            <Flag code={market.code} className="size-5" />
            <span>
              <b className="font-semibold">{shipsHere ? `Ships to ${market.name}` : `New to ${market.name}`}</b>
              <span className="text-ink-2"> · {shipsHere ? "duties shown before you pay" : "first orders ship with extra tracking"}</span>
            </span>
          </p>
        </div>
        <div className="mt-3">
          <SellerCouponChip sellerId={seller.id} limit={3} />
        </div>
      </div>

      <div role="tablist" aria-label="Store sections" className="no-scrollbar sticky top-0 z-10 mt-5 flex gap-1 overflow-x-auto border-b border-line bg-canvas/80 px-3.5 py-2 backdrop-blur-2xl lg:px-6">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`flex h-10 shrink-0 items-center gap-1.5 rounded-full px-4 text-[14px] font-semibold transition-colors ${tab === t.id ? "glass-selected text-ink" : "text-ink-2 hover:text-ink"}`}
          >
            {t.label}
            {t.count !== undefined && <span className="text-xs text-ink-3">{compact(t.count)}</span>}
          </button>
        ))}
      </div>

      <div className="px-3.5 pt-4 lg:px-6">
        {tab === "products" && (
          <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            {products.map((p) => (
              <li key={p.slug}>
                <ProductCard product={p} sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw" />
              </li>
            ))}
          </ul>
        )}

        {tab === "videos" &&
          (videos.length ? (
            <ul className="grid grid-cols-3 gap-1.5 sm:grid-cols-4 lg:grid-cols-5">
              {videos.map((v) => (
                <li key={v.id}>
                  <Link href={`/?v=${v.id}`} className="relative block aspect-[9/16] overflow-hidden rounded-[16px] bg-surface">
                    <Image src={v.image} alt="" fill sizes={capDensity("(min-width: 1024px) 20vw, 33vw")} className="object-cover" />
                    <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    <span className="absolute bottom-2 left-2 flex items-center gap-1 text-[11px] font-bold text-legible">
                      <Icon name="play" filled className="size-3" />
                      {compact(v.likes)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-10 text-center text-sm text-ink-2">No videos yet. Follow to see their first one.</p>
          ))}

        {tab === "reviews" && (
          <div className="flex flex-col gap-4">
            <RatingSummary rating={profile.rating} count={reviewCount} summary={summary} />
            {reviews.length ? <ReviewList reviews={reviews} showProduct /> : <p className="py-6 text-center text-sm text-ink-2">Written reviews will show here.</p>}
          </div>
        )}

        {tab === "factory" && (
          <div className="grid gap-4 lg:grid-cols-2">
            <section aria-label="Facts" className="glass rounded-[26px] p-4">
              <h2 className="mb-3 text-[15px] font-bold">At a glance</h2>
              <dl className="grid grid-cols-2 gap-3">
                {[
                  ["In business", seller.years ? `${seller.years} years` : "New"],
                  ["People", profile.staff ? profile.staff.toLocaleString("en-US") : "Small team"],
                  ["Floor area", profile.floorArea ?? "Studio"],
                  ["Capacity", profile.capacity ?? "Made to order"],
                ].map(([label, value]) => (
                  <div key={label} className="glass-inset rounded-2xl px-3.5 py-3">
                    <dt className="text-[11px] font-semibold text-ink-3">{label}</dt>
                    <dd className="mt-0.5 text-[15px] font-semibold">{value}</dd>
                  </div>
                ))}
              </dl>
              <h3 className="mt-4 mb-2 text-[13px] font-semibold text-ink-2">Certificates</h3>
              <ul className="flex flex-wrap gap-1.5">
                {profile.certificates.map((c) => (
                  <li key={c} className="flex h-8 items-center gap-1.5 rounded-full bg-positive/12 px-3 text-xs font-semibold text-positive">
                    <Icon name="check" className="size-3.5" />
                    {c}
                  </li>
                ))}
              </ul>
              <h3 className="mt-4 mb-2 text-[13px] font-semibold text-ink-2">Already ships to</h3>
              <ul className="flex flex-wrap gap-1.5">
                {profile.exportsTo.map((code) => (
                  <li key={code} className="glass-inset flex h-8 items-center gap-1.5 rounded-full pr-3 pl-1.5 text-xs font-semibold">
                    <Flag code={code} className="size-5" />
                    {code}
                  </li>
                ))}
              </ul>
            </section>

            <section aria-label="Audit report" className="glass flex flex-col rounded-[26px] p-4">
              <div className="flex items-start gap-3">
                <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-positive/15 text-positive">
                  <Icon name="shield" className="size-6" />
                </span>
                <div>
                  <h2 className="text-[15px] font-bold">{seller.audited ? "On-site audit passed" : "Business verified"}</h2>
                  <p className="text-[13px] text-ink-2">
                    {seller.audited
                      ? `Our inspectors visited ${seller.city.split(",")[0]} in ${seller.audited}: licences, production lines, quality control and working conditions.`
                      : "Licence, bank account and export records checked. On-site audit scheduled."}
                  </p>
                </div>
              </div>
              <ul className="mt-4 flex flex-col gap-2 text-[13px]">
                {["Business licence and export rights", "Production capacity matches listings", "Quality control on every batch", "Safe, fairly paid workplace"].map((check, i) => (
                  <li key={check} className="flex items-center gap-2.5">
                    <Icon name="check" className={`size-[18px] ${seller.audited || i === 0 ? "text-positive" : "text-ink-3"}`} />
                    <span className={seller.audited || i === 0 ? "" : "text-ink-3"}>{check}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 grid grid-cols-3 gap-1.5">
                {[profile.cover, ...products.slice(0, 2).map((p) => p.images[0])].map((src) => (
                  <span key={src} className="relative aspect-square overflow-hidden rounded-xl">
                    <Image src={src} alt="" fill sizes="120px" className="object-cover" />
                  </span>
                ))}
              </div>
              <button type="button" className="glass-inset mt-4 flex h-11 items-center justify-center gap-2 rounded-full text-[13px] font-semibold">
                <Icon name="eye" className="size-4" />
                Read the full report
              </button>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}

