import type { Metadata } from "next";
import { Suspense } from "react";
import { SearchScreen } from "@/components/search/search-screen";
import { getCategories } from "@/server/catalog";

export const metadata: Metadata = { title: "Search" };

// The query lives in the URL, so the screen reads it inside Suspense and the shell stays static.
export default async function SearchPage() {
  const categories = await getCategories();
  return (
    <Suspense fallback={<div className="pt-safe mx-3.5 mt-2 h-12 rounded-full skeleton" />}>
      <SearchScreen categories={categories} />
    </Suspense>
  );
}
