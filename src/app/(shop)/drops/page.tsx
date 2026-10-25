import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ChopOffers } from "@/components/drops/chop-offers";
import { DropsCalendar } from "@/components/drops/drops-calendar";
import { LiveNow } from "@/components/drops/live-now";
import { TeamBuys } from "@/components/drops/team-buys";
import { Icon } from "@/components/icon";
import { photo } from "@/lib/images";
import { getProducts, getSellers } from "@/server/catalog";
import { services } from "@/server/container";
import { getLiveLobby } from "@/server/live";
import { festivalKey, festivalStart, getChopOffers, getTeamOffers } from "@/server/promos";
import { currentAccount } from "@/server/session";

export const metadata: Metadata = { title: "Drops" };

export default function DropsPage() {
  return (
    <div className="mx-auto flex max-w-[1080px] flex-col gap-8 px-3.5 pt-safe pb-36 lg:px-6 lg:py-8">
      <header className="pt-4 lg:pt-0">
        <h1 className="font-display text-[34px] font-extrabold tracking-[-0.03em]">Drops</h1>
        <p className="text-[15px] text-ink-2">Deals live now, chops, team buys and what&apos;s coming. Better together, never fake urgency.</p>
      </header>
      <Suspense
        fallback={
          <div className="flex flex-col gap-4">
            <div className="skeleton h-[260px] rounded-[32px]" />
            <div className="skeleton h-[150px] rounded-[26px]" />
          </div>
        }
      >
        <DropsBody />
      </Suspense>
    </div>
  );
}

async function DropsBody() {
  await connection();
  const app = await services();
  const account = await currentAccount();
  const festival = festivalStart();
  const [drops, chopOffers, teamOffers, products, lobby, sellers, festivalReminded] = await Promise.all([
    app.promos.drops(account?.id ?? null),
    getChopOffers(),
    getTeamOffers(),
    getProducts({ limit: 500 }),
    getLiveLobby(),
    getSellers(),
    account ? app.promos.reminded(account.id, festivalKey(festival)) : Promise.resolve(false),
  ]);
  const bySlug = new Map(products.map((p) => [p.slug, p]));
  const info = (slug: string) => {
    const p = bySlug.get(slug);
    return p ? { title: p.title, image: p.images[0], price: p.price ?? null } : null;
  };
  const withProduct = <T extends { slug: string }>(list: T[]) => list.flatMap((x) => (info(x.slug) ? [{ ...x, product: info(x.slug)! }] : []));

  const live = withProduct(drops.filter((d) => (d.state === "live" || d.state === "sold_out") && d.price !== null));
  const upcoming = withProduct(drops.filter((d) => d.state === "upcoming"));
  const auction = lobby.live.find((s) => s.kind === "auction");
  const host = auction && sellers.find((s) => s.id === auction.sellerId);

  return (
    <>
      <LiveNow drops={live} />

      <section aria-labelledby="chops-h">
        <h2 id="chops-h" className="font-display text-2xl font-extrabold tracking-[-0.02em]">
          Chop it with friends
        </h2>
        <p className="mb-3 text-sm text-ink-2">Every friend who taps takes the same slice off. The target and the clock never move.</p>
        <ChopOffers items={chopOffers.flatMap((offer) => (info(offer.slug) ? [{ offer, product: info(offer.slug)! }] : []))} />
      </section>

      <TeamBuys items={teamOffers.flatMap(({ offer, open }) => (info(offer.slug) ? [{ offer, open, product: info(offer.slug)! }] : []))} />

      <DropsCalendar drops={upcoming} festival={{ at: festival.toISOString(), reminded: festivalReminded }} />

      <section aria-label="More ways to shop" className="grid gap-3 lg:grid-cols-2">
        {auction && (
          <Link href={`/live/${auction.id}`} className="group relative min-h-[300px] overflow-hidden rounded-[32px]">
            <Image src={auction.coverUrl} alt="" fill sizes="(min-width: 1024px) 520px, 100vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
            <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,transparent_30%,rgb(0_0_0/0.8))]" />
            <span className="absolute top-4 left-4 flex h-[26px] items-center gap-1.5 rounded-full bg-live px-2.5 text-[11px] font-extrabold tracking-[0.08em]">
              <span className="size-1.5 rounded-full bg-white motion-safe:animate-blink" />
              LIVE AUCTION
            </span>
            <div className="glass absolute inset-x-3 bottom-3 flex items-center gap-3 rounded-[24px] p-3">
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-[15px] font-bold">{auction.title}</h2>
                <p className="text-xs text-ink-2">
                  {host?.name ?? auction.hostName} · {auction.place}
                </p>
              </div>
              <span className="flex h-11 items-center gap-1.5 rounded-full bg-accent px-4 text-sm font-bold">
                <Icon name="gavel" className="size-4" strokeWidth={2.2} />
                Bid
              </span>
            </div>
          </Link>
        )}
        <Link href="/unbox" className="glass flex flex-col gap-4 rounded-[32px] p-4">
          <div className="relative aspect-[16/10] overflow-hidden rounded-[24px]">
            <Image src={photo("1776969700664-5b8f9e32a2f6", { ar: "16:10" })} alt="An art-toy shop window full of collectible figures" fill sizes="(min-width: 1024px) 520px, 100vw" className="object-cover" />
          </div>
          <div>
            <p className="text-[11px] font-extrabold tracking-[0.1em] text-accent-light">BLIND BOXES</p>
            <h2 className="mt-0.5 font-display text-xl font-extrabold">Pick a box from the case</h2>
            <p className="mt-1 text-sm text-ink-2">Shake for hints, see the published odds, and open it with one tap.</p>
          </div>
          <span className="glass-inset flex h-11 w-fit items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold">
            <Icon name="cube" className="size-4" />
            Pick a box
          </span>
        </Link>
      </section>
    </>
  );
}
