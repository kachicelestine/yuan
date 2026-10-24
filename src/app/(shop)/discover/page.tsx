import type { Metadata } from "next";
import { Suspense } from "react";
import { DiscoverBoard, type BoardNote } from "@/components/discover/discover-board";
import { getCategories, getProducts } from "@/server/catalog";
import { getNotes } from "@/server/content";

export const metadata: Metadata = { title: "Discover" };

export default async function DiscoverPage() {
  const [products, categories, notes] = await Promise.all([getProducts(), getCategories(), getNotes()]);
  const board: BoardNote[] = notes.map((note) => {
    const product = note.productSlug ? products.find((p) => p.slug === note.productSlug) : undefined;
    return product ? { ...note, product: { slug: product.slug, title: product.title, price: product.price } } : note;
  });

  return (
    <div className="mx-auto max-w-[1400px] px-3.5 pb-36 lg:px-6 lg:pb-10">
      {/* The board reads ?q= from the URL, so it renders on the client behind this boundary. */}
      <Suspense fallback={<h1 className="pt-safe px-0.5 pt-6 font-display text-[34px] font-extrabold tracking-[-0.03em]">Discover</h1>}>
        <DiscoverBoard notes={board} categories={categories.map(({ id, label }) => ({ id, label }))} />
      </Suspense>
    </div>
  );
}

