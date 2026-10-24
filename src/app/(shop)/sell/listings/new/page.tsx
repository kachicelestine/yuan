import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ListingEditor } from "@/components/sell/listing-editor";
import { SellFrame, SellSkeleton } from "@/components/sell/sell-frame";
import { getCategories } from "@/server/catalog";
import { currentShop } from "@/server/shop";

export const metadata: Metadata = { title: "New listing" };

export default function NewListingPage() {
  return (
    <Suspense fallback={<SellSkeleton />}>
      <NewListing />
    </Suspense>
  );
}

async function NewListing() {
  await connection();
  if (!(await currentShop())) redirect("/sell");
  const categories = await getCategories();
  return (
    <SellFrame title="New listing" back="/sell">
      <ListingEditor listing={null} categories={categories.map(({ id, label }) => ({ id, label }))} />
    </SellFrame>
  );
}
