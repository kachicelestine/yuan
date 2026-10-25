import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { BusinessScreen, type ListingInfo, type ShopInfo } from "@/components/business/business-screen";
import { getProductsBySlugs, getSellerPage } from "@/server/catalog";
import { services } from "@/server/container";
import { currentAccount } from "@/server/session";

export const metadata: Metadata = { title: "Business" };

export default function BusinessPage() {
  return (
    <Suspense fallback={<div className="skeleton pt-safe mx-3.5 mt-16 h-96 rounded-[26px]" />}>
      <Body />
    </Suspense>
  );
}

async function Body() {
  // Your requests and their quotes are per request.
  await connection();
  const account = await currentAccount();
  if (!account) return <BusinessScreen signedIn={false} rfqs={[]} shops={{}} listings={{}} />;
  const rfqs = await (await services()).sourcing.mine(account.id);
  const quotes = rfqs.flatMap((r) => r.quotes);
  const [pages, products] = await Promise.all([Promise.all([...new Set(quotes.map((q) => q.sellerId))].map(getSellerPage)), getProductsBySlugs([...new Set(quotes.map((q) => q.slug))])]);
  const shops: Record<string, ShopInfo> = Object.fromEntries(
    pages.flatMap((p) => (p ? [[p.seller.id, { name: p.seller.name, avatar: p.seller.avatar, verified: p.seller.verified, rating: p.storefront?.rating ?? 0, responseHours: p.storefront?.responseHours || null }]] : [])),
  );
  const listings: Record<string, ListingInfo> = Object.fromEntries(products.map((p) => [p.slug, { title: p.title, image: p.images[0] }]));
  return <BusinessScreen signedIn rfqs={rfqs} shops={shops} listings={listings} />;
}
