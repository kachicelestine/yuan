import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { CreatorHub, CreatorHubSkeleton } from "@/components/creator/creator-hub";
import { getProducts } from "@/server/catalog";
import { services } from "@/server/container";
import { currentAccount } from "@/server/session";

export const metadata: Metadata = { title: "Creator hub" };

export default function CreatorPage() {
  return (
    <Suspense fallback={<CreatorHubSkeleton />}>
      <CreatorBody />
    </Suspense>
  );
}

async function CreatorBody() {
  await connection();
  const account = await currentAccount();
  if (!account) redirect("/signin?next=/creator");
  const app = await services();
  const [data, available, payouts, popular] = await Promise.all([
    app.affiliates.dashboard(account.id),
    app.escrow.creatorAvailable(account.id),
    app.escrow.creatorPayouts(account.id, 10),
    getProducts({ limit: 24 }),
  ]);
  const linked = await app.catalog.getProductsBySlugs(data.links.map((l) => l.slug));
  const rates = await app.affiliates.rates([...new Set(popular.map((p) => p.sellerId))]);
  const products = Object.fromEntries([...linked, ...popular].map((p) => [p.slug, { title: p.title, image: p.images[0] }]));
  // Products worth promoting: best sellers whose shops pay creators.
  const promote = popular
    .filter((p) => (rates.get(p.sellerId) ?? 0) > 0 && p.price !== undefined)
    .slice(0, 8)
    .map((p) => ({ slug: p.slug, title: p.title, image: p.images[0], price: p.price!, rate: rates.get(p.sellerId)! }));
  return <CreatorHub data={data} available={available / 100} payouts={payouts} products={products} promote={promote} />;
}
