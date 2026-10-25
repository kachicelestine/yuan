import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AdsManager } from "@/components/sell/ads-manager";
import { SellFrame, SellSkeleton } from "@/components/sell/sell-frame";
import { services } from "@/server/container";
import { currentShop } from "@/server/shop";

export const metadata: Metadata = { title: "Ads" };

export default function SellAdsPage() {
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
  const [campaigns, listings, available] = await Promise.all([app.ads.list(shop.sellerId), app.selling.listings(shop.sellerId), app.escrow.available(shop.sellerId)]);
  return (
    <SellFrame title="Ads" back="/sell" subtitle="Put your listings first in search and on category pages. You pay only when someone taps, from your balance.">
      <AdsManager
        campaigns={campaigns}
        listings={listings.filter((l) => l.status === "active").map(({ slug, title, images, price }) => ({ slug, title, image: images[0], price: price ?? null }))}
        balance={available / 100}
        owner={shop.role === "owner"}
      />
    </SellFrame>
  );
}
