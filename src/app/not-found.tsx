import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/empty-state";
import { Icon } from "@/components/icon";
import { trendingSearches } from "@/lib/catalog";

export const metadata: Metadata = { title: "Lost in customs" };

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center pt-safe pb-safe">
      <EmptyState
        icon="ship"
        title="This page got lost in customs"
        body="The link may be old, or the listing sold out and was taken down. Everything else is still here."
        primary={{ href: "/", label: "Back to the feed" }}
        secondary={{ href: "/discover", label: "Discover something new" }}
        tint="from-series/50 to-accent/30"
      >
        <Link href="/search" className="glass flex h-12 w-full items-center gap-2.5 rounded-full px-4 text-[15px] text-ink-3">
          <Icon name="search" className="size-5 text-ink-2" />
          Search anything made in China
        </Link>
        <p className="mt-5 mb-2 text-xs font-bold tracking-[0.1em] text-ink-3">TRY SEARCHING</p>
        <ul className="flex flex-wrap justify-center gap-1.5">
          {trendingSearches.slice(0, 6).map((t) => (
            <li key={t}>
              <Link href={`/search?q=${encodeURIComponent(t)}`} className="glass-inset flex h-9 items-center rounded-full px-3.5 text-[13px] font-semibold">
                {t}
              </Link>
            </li>
          ))}
        </ul>
      </EmptyState>
    </main>
  );
}
