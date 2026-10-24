import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { LiveStudio } from "@/components/sell/live-studio";
import { SellFrame, SellSkeleton } from "@/components/sell/sell-frame";
import { services } from "@/server/container";
import { currentShop } from "@/server/shop";

export const metadata: Metadata = { title: "Live studio", robots: { index: false } };

// Shows are private to their shop, so nothing is prerendered; the placeholder lets the shell build.
export function generateStaticParams() {
  return [{ id: "00000000-0000-0000-0000-000000000000" }];
}

export default function StudioPage({ params }: PageProps<"/sell/live/[id]">) {
  return (
    <Suspense fallback={<SellSkeleton />}>
      <Studio params={params} />
    </Suspense>
  );
}

async function Studio({ params }: { params: PageProps<"/sell/live/[id]">["params"] }) {
  await connection();
  const shop = await currentShop();
  if (!shop) redirect("/sell");
  const { id } = await params;
  const app = await services();
  const studio = await app.live.studio(shop.sellerId, id);
  if (!studio) notFound();
  const [room, listings] = await Promise.all([app.live.show(id), app.selling.listings(shop.sellerId)]);
  return (
    <SellFrame title={studio.title} back="/sell/live">
      <LiveStudio show={studio} messages={room?.messages ?? []} lots={room?.lots ?? []} listings={listings.map(({ slug, title, images, price }) => ({ slug, title, images, price }))} />
    </SellFrame>
  );
}
