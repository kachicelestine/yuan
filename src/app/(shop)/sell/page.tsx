import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ApplyForm } from "@/components/sell/apply-form";
import { brand } from "@/config/brand";
import { SellerDashboard } from "@/components/sell/seller-dashboard";
import { SellFrame, SellSkeleton } from "@/components/sell/sell-frame";
import { services } from "@/server/container";
import { currentAccount } from "@/server/session";
import { currentShop } from "@/server/shop";

export const metadata: Metadata = { title: "Sell" };

export default function SellPage() {
  return (
    <Suspense fallback={<SellSkeleton />}>
      <SellBody />
    </Suspense>
  );
}

async function SellBody() {
  // Everything here is the signed-in person's own, read fresh.
  await connection();
  const account = await currentAccount();
  if (!account) redirect("/signin?next=/sell");
  const app = await services();
  const shop = await currentShop();
  if (!shop) {
    return (
      <SellFrame title={`Sell on ${brand.name}`} subtitle="Tell us about your business. We check every seller by hand, so buyers can trust the badge.">
        <ApplyForm application={await app.onboarding.mine(account.id)} />
      </SellFrame>
    );
  }
  const [page, listings, orders, questions] = await Promise.all([
    app.catalog.getSeller(shop.sellerId),
    app.selling.listings(shop.sellerId),
    app.sellerOrders.list(shop.sellerId),
    app.content.unansweredQuestions(shop.sellerId),
  ]);
  if (!page) redirect("/me");
  return (
    <SellFrame title="Your shop">
      <SellerDashboard seller={page.seller} storefront={page.storefront} listings={listings} orders={orders} questions={questions} />
    </SellFrame>
  );
}
