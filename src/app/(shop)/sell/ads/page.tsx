import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AdsManager } from "@/components/sell/ads-manager";
import { ChopOffersManager } from "@/components/sell/chop-offers-manager";
import { DepositOffersManager } from "@/components/sell/deposit-offers-manager";
import { DropsManager, TeamOffersManager } from "@/components/sell/drops-manager";
import { SamplesManager } from "@/components/sell/samples-manager";
import { SellFrame, SellSkeleton } from "@/components/sell/sell-frame";
import { services } from "@/server/container";
import { currentShop } from "@/server/shop";

export const metadata: Metadata = { title: "Promote" };

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
  const [campaigns, listings, available, offers, drops, teams, sampleOffers, sampleRequests, depositOffers] = await Promise.all([
    app.ads.list(shop.sellerId),
    app.selling.listings(shop.sellerId),
    app.escrow.available(shop.sellerId),
    app.chops.sellerOffers(shop.sellerId),
    app.promos.sellerDrops(shop.sellerId),
    app.promos.sellerTeamOffers(shop.sellerId),
    app.samples.sellerOffers(shop.sellerId),
    app.samples.sellerRequests(shop.sellerId),
    app.deposits.sellerOffers(shop.sellerId),
  ]);
  const live = listings.filter((l) => l.status === "active").map(({ slug, title, images, price }) => ({ slug, title, image: images[0], price: price ?? null }));
  return (
    <SellFrame title="Promote" back="/sell" subtitle="Sponsored listings put you first in search; drops, team buys and chops bring shoppers back with their friends.">
      <section aria-labelledby="ads-h" className="flex flex-col gap-2">
        <h2 id="ads-h" className="px-1 font-display text-xl font-bold">
          Sponsored listings
        </h2>
        <AdsManager campaigns={campaigns} listings={live} balance={available / 100} owner={shop.role === "owner"} />
      </section>
      <section aria-labelledby="chops-h" className="mt-6 flex flex-col gap-2">
        <h2 id="chops-h" className="px-1 font-display text-xl font-bold">
          Chop with friends
        </h2>
        <ChopOffersManager offers={offers} listings={live} owner={shop.role === "owner"} />
      </section>
      <section aria-labelledby="drops-h" className="mt-6 flex flex-col gap-2">
        <h2 id="drops-h" className="px-1 font-display text-xl font-bold">
          Drops
        </h2>
        <DropsManager drops={drops} listings={live} owner={shop.role === "owner"} />
      </section>
      <section aria-labelledby="teams-h" className="mt-6 flex flex-col gap-2">
        <h2 id="teams-h" className="px-1 font-display text-xl font-bold">
          Team buys
        </h2>
        <TeamOffersManager offers={teams} listings={live} owner={shop.role === "owner"} />
      </section>
      <section aria-labelledby="deposits-h" className="mt-6 flex flex-col gap-2">
        <h2 id="deposits-h" className="px-1 font-display text-xl font-bold">
          Pre-orders and pre-sales
        </h2>
        <DepositOffersManager offers={depositOffers} listings={live} owner={shop.role === "owner"} />
      </section>
      <section aria-labelledby="samples-h" className="mt-6 flex flex-col gap-2">
        <h2 id="samples-h" className="px-1 font-display text-xl font-bold">
          Creator samples
        </h2>
        <SamplesManager offers={sampleOffers} requests={sampleRequests} listings={live} owner={shop.role === "owner"} />
      </section>
    </SellFrame>
  );
}
