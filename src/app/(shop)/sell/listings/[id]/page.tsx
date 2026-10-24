import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ListingEditor } from "@/components/sell/listing-editor";
import { SellFrame, SellSkeleton } from "@/components/sell/sell-frame";
import { getCategories } from "@/server/catalog";
import { services } from "@/server/container";
import { currentShop } from "@/server/shop";

export const metadata: Metadata = { title: "Edit listing" };

// Ids are private and per person, so nothing is prerendered; one placeholder lets the
// shared shell build (the body below is always rendered per request).
export function generateStaticParams() {
  return [{ id: "00000000-0000-0000-0000-000000000000" }];
}

export default function EditListingPage({ params }: PageProps<"/sell/listings/[id]">) {
  return (
    <Suspense fallback={<SellSkeleton />}>
      <EditListing params={params} />
    </Suspense>
  );
}

async function EditListing({ params }: { params: PageProps<"/sell/listings/[id]">["params"] }) {
  await connection();
  const { id } = await params;
  const shop = await currentShop();
  if (!shop) redirect("/sell");
  const [listing, categories] = await Promise.all([(await services()).selling.listing(shop.sellerId, id), getCategories()]);
  if (!listing) notFound();
  return (
    <SellFrame title="Edit listing" back="/sell">
      <ListingEditor listing={listing} categories={categories.map(({ id: c, label }) => ({ id: c, label }))} />
    </SellFrame>
  );
}
