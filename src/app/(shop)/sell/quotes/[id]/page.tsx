import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { QuoteDesk } from "@/components/sell/quotes";
import { SellFrame, SellSkeleton } from "@/components/sell/sell-frame";
import { services } from "@/server/container";
import { currentShop } from "@/server/shop";

export const metadata: Metadata = { title: "Quote request", robots: { index: false } };

// Requests are private to the shops they were sent to; the placeholder lets the shell build.
export function generateStaticParams() {
  return [{ id: "aaaaaaaa" }];
}

export default function SellQuotePage({ params }: PageProps<"/sell/quotes/[id]">) {
  return (
    <Suspense fallback={<SellSkeleton />}>
      <Body params={params} />
    </Suspense>
  );
}

async function Body({ params }: { params: PageProps<"/sell/quotes/[id]">["params"] }) {
  await connection();
  const shop = await currentShop();
  if (!shop) redirect("/sell");
  const { id } = await params;
  const app = await services();
  const [rfq, listings] = await Promise.all([app.sourcing.forShop(shop.sellerId, id), app.selling.listings(shop.sellerId)]);
  if (!rfq) notFound();
  const live = listings.filter((l) => l.status === "active").map(({ slug, title, images, price }) => ({ slug, title, image: images[0], price: price ?? null }));
  return (
    <SellFrame title={rfq.code} back="/sell/quotes">
      <QuoteDesk initial={rfq} listings={live} />
    </SellFrame>
  );
}
