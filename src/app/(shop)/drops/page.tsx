import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { DropsCalendar } from "@/components/drops/drops-calendar";
import { NightDeals, type Deal } from "@/components/drops/night-deals";
import { RemindButton } from "@/components/drops/remind-button";
import { TeamBuyCard } from "@/components/drops/team-buy-card";
import { Icon } from "@/components/icon";
import { Price } from "@/components/price";
import { auctionRoom, flashDeals, getProduct, getSeller, teamBuys } from "@/lib/catalog";
import { chops, priceAfter } from "@/lib/chops";
import { photo } from "@/lib/images";

export const metadata: Metadata = { title: "Drops" };

export default function DropsPage() {
  const deals: Deal[] = flashDeals.flatMap((d) => {
    const product = getProduct(d.slug);
    return product ? [{ product, dealPrice: d.dealPrice, claimed: d.claimed }] : [];
  });
  const teams = teamBuys.flatMap((team) => {
    const product = getProduct(team.slug);
    return product ? [{ product, team }] : [];
  });
  const lot = auctionRoom.lots[0];
  const studio = getSeller(auctionRoom.sellerId);
  const toy = getProduct("art-toy-blind-box");

  return (
    <div className="mx-auto flex max-w-[1080px] flex-col gap-8 px-3.5 pt-safe pb-36 lg:px-6 lg:py-8">
      <header className="pt-4 lg:pt-0">
        <h1 className="font-display text-[34px] font-extrabold tracking-[-0.03em]">Drops</h1>
        <p className="text-[15px] text-ink-2">Night deals, team buys and live auctions. Better together, never fake urgency.</p>
      </header>

      <NightDeals deals={deals} />

      <section aria-labelledby="chops-h">
        <h2 id="chops-h" className="font-display text-2xl font-extrabold tracking-[-0.02em]">
          Chop it with friends
        </h2>
        <p className="mb-3 text-sm text-ink-2">Every friend who taps takes the same slice off. The target and the clock never move.</p>
        <ul className="no-scrollbar -mx-3.5 flex gap-2.5 overflow-x-auto px-3.5 lg:mx-0 lg:grid lg:grid-cols-3 lg:px-0">
          {chops.map((c) => {
            const product = getProduct(c.slug);
            if (!product) return null;
            const done = c.friends.length;
            return (
              <li key={c.id} className="w-[260px] shrink-0 lg:w-auto">
                <Link href={`/chop/${c.id}`} className="glass flex h-full flex-col gap-3 rounded-[26px] p-3">
                  <span className="flex items-center gap-3">
                    <Image src={product.images[0]} alt="" width={64} height={64} sizes="64px" className="size-16 shrink-0 rounded-2xl object-cover" />
                    <span className="min-w-0">
                      <span className="line-clamp-2 text-sm leading-snug font-semibold">{product.title}</span>
                      <span className="mt-0.5 flex items-baseline gap-1.5">
                        <Price usd={priceAfter(c, product, done)} className="font-display text-lg font-extrabold" />
                        <span className="text-xs text-ink-2">
                          → <Price usd={c.target} className="font-bold text-save" />
                        </span>
                      </span>
                    </span>
                  </span>
                  <span className="flex gap-0.5" aria-label={`${done} of ${c.cuts} cuts`}>
                    {Array.from({ length: c.cuts }, (_, i) => (
                      <span key={i} className={`h-1.5 flex-1 rounded-full ${i < done ? "bg-accent-light" : "bg-white/12"}`} />
                    ))}
                  </span>
                  <span className="flex items-center gap-2 text-xs text-ink-2">
                    <span className="flex -space-x-1.5">
                      {c.friends.map((f) => (
                        <Image key={f.name} src={f.avatar} alt="" width={22} height={22} sizes="22px" className="size-[22px] rounded-full object-cover ring-2 ring-surface" />
                      ))}
                    </span>
                    {c.cuts - done} cuts to go
                    <span className="ml-auto flex h-8 items-center gap-1 rounded-full bg-accent px-3 font-bold text-white">
                      <Icon name="scissors" className="size-3.5" />
                      Chop
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="team-buys">
        <h2 id="team-buys" className="font-display text-2xl font-extrabold tracking-[-0.02em]">
          Team buys
        </h2>
        <p className="mb-3 text-sm text-ink-2">Bring friends, or join strangers, and everyone pays the team price.</p>
        <div className="grid gap-3 lg:grid-cols-2">
          {teams.map(({ product, team }) => (
            <TeamBuyCard key={product.slug} product={product} team={team} />
          ))}
        </div>
      </section>

      <DropsCalendar />

      <section aria-labelledby="auction" className="grid gap-3 lg:grid-cols-2">
        <Link href="/live/auction" className="group relative min-h-[300px] overflow-hidden rounded-[32px]">
          <Image src={auctionRoom.image} alt="" fill sizes="(min-width: 1024px) 520px, 100vw" className="object-cover transition-transform duration-700 group-hover:scale-105" />
          <div aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(180deg,transparent_30%,rgb(0_0_0/0.8))]" />
          <span className="absolute top-4 left-4 flex h-[26px] items-center gap-1.5 rounded-full bg-live px-2.5 text-[11px] font-extrabold tracking-[0.08em]">
            <span className="size-1.5 rounded-full bg-white motion-safe:animate-blink" />
            LIVE AUCTION
          </span>
          <div className="glass absolute inset-x-3 bottom-3 flex items-center gap-3 rounded-[24px] p-3">
            <Image src={lot.image} alt="" width={56} height={56} sizes="56px" className="size-14 rounded-2xl object-cover" />
            <div className="min-w-0 flex-1">
              <h2 id="auction" className="truncate text-[15px] font-bold">
                {lot.title}
              </h2>
              <p className="text-xs text-ink-2">
                {studio.name} · top bid <Price usd={lot.current} />
              </p>
            </div>
            <span className="flex h-11 items-center gap-1.5 rounded-full bg-accent px-4 text-sm font-bold">
              <Icon name="gavel" className="size-4" strokeWidth={2.2} />
              Bid
            </span>
          </div>
        </Link>

        {toy && (
          <article className="glass flex flex-col gap-4 rounded-[32px] p-4">
            <div className="relative aspect-[16/10] overflow-hidden rounded-[24px]">
              <Image src={photo("1776969700664-5b8f9e32a2f6", { ar: "16:10" })} alt="An art-toy shop window full of collectible figures" fill sizes="(min-width: 1024px) 520px, 100vw" className="object-cover" />
              <span className="glass absolute top-3 left-3 flex h-7 items-center rounded-full px-3 text-xs font-bold">Next drop · Friday 20:00</span>
            </div>
            <div>
              <p className="text-[11px] font-extrabold tracking-[0.1em] text-accent-light">BLIND BOX SERIES</p>
              <h2 className="mt-0.5 font-display text-xl font-extrabold">Night Market, 12 + 1 secret</h2>
              <p className="mt-1 text-sm text-ink-2">
                {toy.title} from <Price usd={toy.price ?? 0} />. One per person for the first hour, so bots don&apos;t win.
              </p>
            </div>
            <div className="mt-auto flex items-center gap-2">
              <RemindButton />
              <Link href="/unbox" className="glass-inset flex h-11 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold">
                <Icon name="cube" className="size-4" />
                Pick a box now
              </Link>
            </div>
          </article>
        )}
      </section>
    </div>
  );
}

