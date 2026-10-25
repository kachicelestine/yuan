import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { QuoteRequests } from "@/components/sell/quotes";
import { SellFrame, SellSkeleton } from "@/components/sell/sell-frame";
import { services } from "@/server/container";
import { currentShop } from "@/server/shop";

export const metadata: Metadata = { title: "Quote requests", robots: { index: false } };

export default function SellQuotesPage() {
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
  const rfqs = await (await services()).sourcing.inbox(shop.sellerId);
  return (
    <SellFrame title="Quote requests" back="/sell" subtitle="Bulk buyers ask several shops at once. Quote one of your listings; if they accept, they check out at your price.">
      <QuoteRequests rfqs={rfqs} />
    </SellFrame>
  );
}
