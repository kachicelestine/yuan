import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { LiveShows } from "@/components/sell/live-shows";
import { SellFrame, SellSkeleton } from "@/components/sell/sell-frame";
import { services } from "@/server/container";
import { currentShop } from "@/server/shop";

export const metadata: Metadata = { title: "Go live" };

export default function SellLivePage() {
  return (
    <Suspense fallback={<SellSkeleton />}>
      <Body />
    </Suspense>
  );
}

async function Body() {
  await connection();
  const shop = await currentShop();
  if (!shop) redirect("/sell");
  const app = await services();
  const [shows, listings, page] = await Promise.all([app.live.forSeller(shop.sellerId), app.selling.listings(shop.sellerId), app.catalog.getSeller(shop.sellerId)]);
  return (
    <SellFrame title="Go live" back="/sell" subtitle="Show your products live, answer questions, sell at live prices or by auction.">
      <LiveShows
        shows={shows}
        listings={listings.filter((l) => l.status === "active").map(({ slug, title, images, price }) => ({ slug, title, images, price }))}
        cover={page?.storefront?.cover ?? "/shop.svg"}
        hostName={page?.seller.name ?? ""}
      />
    </SellFrame>
  );
}
