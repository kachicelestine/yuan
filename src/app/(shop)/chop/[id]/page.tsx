import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ChopScreen } from "@/components/chop/chop-screen";
import { services } from "@/server/container";
import { getChopOffers } from "@/server/promos";
import { currentAccount } from "@/server/session";
import { readVoter } from "@/server/voter";

export const metadata: Metadata = { title: "Chop the price", description: "Friends each cut the price toward a fixed target." };

// Chops are started by people as they shop, so nothing is prerendered; the placeholder lets the shell build.
export function generateStaticParams() {
  return [{ id: "aaaaaaaa" }];
}

export default function ChopPage({ params }: PageProps<"/chop/[id]">) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-[620px] px-3.5 pt-20">
          <div className="skeleton h-[440px] rounded-[32px]" />
        </div>
      }
    >
      <ChopBody params={params} />
    </Suspense>
  );
}

async function ChopBody({ params }: { params: PageProps<"/chop/[id]">["params"] }) {
  await connection();
  const { id } = await params;
  const app = await services();
  const account = await currentAccount();
  const chop = await app.chops.view(id, { cutter: account?.id ?? (await readVoter()), accountId: account?.id ?? null });
  if (!chop) notFound();
  const offers = (await getChopOffers()).filter((o) => o.slug !== chop.slug).slice(0, 4);
  const found = await app.catalog.getProductsBySlugs([chop.slug, ...offers.map((o) => o.slug)]);
  const info = Object.fromEntries(found.map((p) => [p.slug, { slug: p.slug, title: p.title, image: p.images[0] }]));
  if (!info[chop.slug]) notFound();
  return <ChopScreen initial={chop} product={info[chop.slug]} offers={offers.flatMap((o) => (info[o.slug] ? [{ offer: o, product: info[o.slug] }] : []))} />;
}
