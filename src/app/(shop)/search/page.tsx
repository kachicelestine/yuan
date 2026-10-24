import type { Metadata } from "next";
import { Suspense } from "react";
import { SearchScreen } from "@/components/search/search-screen";
import { getCategories } from "@/server/catalog";

export const metadata: Metadata = { title: "Search" };

// The static shell is the full screen with no query. The query (?q=…, ?snap=1) is read on the
// server inside Suspense, so the real screen streams in the same response, server-rendered:
// no client-side re-render after hydration.
export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const categories = await getCategories();
  return (
    <Suspense fallback={<SearchScreen categories={categories} />}>
      <SearchFromUrl categories={categories} searchParams={searchParams} />
    </Suspense>
  );
}

async function SearchFromUrl({ categories, searchParams }: { categories: Awaited<ReturnType<typeof getCategories>>; searchParams: PageProps<"/search">["searchParams"] }) {
  const { q, snap } = await searchParams;
  return <SearchScreen categories={categories} initialQuery={typeof q === "string" ? q : ""} initialSnap={snap === "1"} />;
}
