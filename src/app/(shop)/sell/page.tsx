import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ApplyForm } from "@/components/sell/apply-form";
import { brand } from "@/config/brand";
import { serverEnv } from "@/config/server-env";
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
  const [page, listings, orders, questions, available, payouts, wallet, program] = await Promise.all([
    app.catalog.getSeller(shop.sellerId),
    app.selling.listings(shop.sellerId),
    app.sellerOrders.list(shop.sellerId),
    app.content.unansweredQuestions(shop.sellerId),
    app.escrow.available(shop.sellerId),
    app.escrow.payouts(shop.sellerId),
    app.onboarding.payoutWallet(shop.sellerId),
    app.affiliates.shopProgram(shop.sellerId),
  ]);
  // What Protect still holds for parcels not yet confirmed, as it will reach the shop.
  const held = orders.filter((o) => o.shipment && ["awaiting_shipment", "shipped", "disputed"].includes(o.shipment.status)).reduce((n, o) => n + o.shipment!.amount, 0);
  const money = {
    available: available / 100,
    // Less what creators will earn on the referred orders among them.
    inProtect: Math.max(0, Math.round((held * (1 - serverEnv.PLATFORM_COMMISSION) - program.pending) * 100) / 100),
    commission: serverEnv.PLATFORM_COMMISSION,
    payouts,
    wallet,
    program,
    explorer: serverEnv.PAYMENTS_BASE_CHAIN === "base" ? "https://basescan.org" : "https://sepolia.basescan.org",
  };
  if (!page) redirect("/me");
  return (
    <SellFrame title="Your shop">
      <SellerDashboard seller={page.seller} storefront={page.storefront} listings={listings} orders={orders} questions={questions} money={money} />
    </SellFrame>
  );
}
