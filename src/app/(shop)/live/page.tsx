import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Icon, VerifiedBadge } from "@/components/icon";
import { LiveSchedule } from "@/components/live/live-schedule";
import { Price } from "@/components/price";
import { auctionRoom, getProduct, getSeller } from "@/lib/catalog";
import { compact } from "@/lib/format";
import { liveReplays, liveRooms, liveSchedule } from "@/lib/live";

export const metadata: Metadata = { title: "Live", description: "Shop live with the factories and makers: shows, factory tours and auctions." };

const kindLabel = { show: "Live show", tour: "Factory tour", auction: "Auction" } as const;

export default function LiveLobby() {
  const [featured, ...rest] = liveRooms;
  const host = getSeller(featured.sellerId);
  const onAir = featured.items.find((i) => i.status === "on-air");
  const onAirProduct = onAir && getProduct(onAir.slug);
  const lot = auctionRoom.lots[0];
  const studio = getSeller(auctionRoom.sellerId);

  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-8 px-3.5 pt-safe pb-36 lg:px-6 lg:pt-6 lg:pb-16">
      <header className="flex items-end justify-between gap-3 pt-4 lg:pt-0">
        <div>
          <h1 className="font-display text-[34px] font-extrabold tracking-[-0.03em]">Live</h1>
          <p className="text-[15px] text-ink-2">Shop with the people who make it.</p>
        </div>
        <span className="flex h-9 items-center gap-1.5 rounded-full bg-live/15 px-3 text-[13px] font-bold text-like">
          <span className="size-1.5 rounded-full bg-live motion-safe:animate-blink" />
          {liveRooms.length + 1} on now
        </span>
      </header>

      <Link href={`/live/${featured.id}`} data-tone="dark" className="group relative block overflow-hidden rounded-[32px]">
        <span className="relative block aspect-[4/5] sm:aspect-[16/9]">
          <Image src={featured.image} alt="" fill loading="eager" sizes="(min-width: 1100px) 1050px, 100vw" className="object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
        </span>
        <span className="absolute inset-0 bg-[linear-gradient(180deg,rgb(0_0_0/0.35),transparent_30%,transparent_45%,rgb(0_0_0/0.85))]" />
        <span className="absolute top-4 left-4 flex gap-1.5">
          <span className="flex h-[26px] items-center gap-1.5 rounded-full bg-live px-2.5 text-[11px] font-extrabold tracking-[0.08em]">
            <span className="size-1.5 rounded-full bg-white motion-safe:animate-blink" />
            LIVE
          </span>
          <span className="glass flex h-[26px] items-center gap-1 rounded-full px-2.5 text-[11px] font-semibold">
            <Icon name="eye" className="size-3.5" />
            {compact(featured.viewers)}
          </span>
        </span>
        <span className="absolute inset-x-4 bottom-4 flex flex-col gap-3">
          <span className="flex items-center gap-2 text-sm font-semibold text-legible">
            <Image src={host.avatar} alt="" width={32} height={32} sizes="32px" className="size-8 rounded-full object-cover ring-2 ring-white/40" />
            {featured.hostName} · {host.name}
            {host.verified && <VerifiedBadge />}
          </span>
          <span className="font-display text-[28px] leading-[1.05] font-extrabold tracking-[-0.02em] text-legible lg:text-[38px]">{featured.title}</span>
          <span className="flex flex-wrap items-center gap-2">
            {onAirProduct && onAir && (
              <span className="glass flex h-12 items-center gap-2 rounded-full pr-4 pl-1.5">
                <Image src={onAirProduct.images[0]} alt="" width={36} height={36} sizes="36px" className="size-9 rounded-full object-cover" />
                <span className="text-[13px] font-semibold">
                  On air: <Price usd={onAir.livePrice} className="font-display font-extrabold" />
                </span>
              </span>
            )}
            <span className="flex h-12 items-center rounded-full bg-accent px-5 text-[15px] font-bold">Join live</span>
          </span>
        </span>
      </Link>

      <section aria-labelledby="on-now">
        <h2 id="on-now" className="mb-3 font-display text-2xl font-extrabold tracking-[-0.02em]">
          On now
        </h2>
        <ul className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {rest.map((room) => {
            const seller = getSeller(room.sellerId);
            const item = room.items.find((i) => i.status === "on-air");
            const product = item && getProduct(item.slug);
            return (
              <li key={room.id}>
                <Link href={`/live/${room.id}`} data-tone="dark" className="group relative block overflow-hidden rounded-[24px]">
                  <span className="relative block aspect-[3/4]">
                    <Image src={room.image} alt="" fill sizes="(min-width: 1100px) 260px, 50vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
                  </span>
                  <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/30" />
                  <span className="absolute top-2.5 left-2.5 flex items-center gap-1 rounded-full bg-live px-2 py-0.5 text-[10px] font-extrabold tracking-[0.06em]">
                    LIVE · {compact(room.viewers)}
                  </span>
                  <span className="absolute inset-x-2.5 bottom-2.5 flex flex-col gap-1.5 text-legible">
                    <span className="text-[10.5px] font-bold tracking-[0.06em] text-white/75 uppercase">{kindLabel[room.kind]}</span>
                    <span className="line-clamp-2 text-[13.5px] leading-snug font-bold">{room.title}</span>
                    <span className="flex items-center gap-1.5 text-[11px] font-semibold text-white/85">
                      <Image src={seller.avatar} alt="" width={18} height={18} sizes="18px" className="size-[18px] rounded-full object-cover" />
                      <span className="truncate">{seller.name}</span>
                    </span>
                    {product && item && (
                      <span className="flex items-center gap-1.5 rounded-full bg-black/45 py-1 pr-2 pl-1 text-[11px] font-semibold backdrop-blur-md">
                        <Image src={product.images[0]} alt="" width={20} height={20} sizes="20px" className="size-5 rounded-full object-cover" />
                        <Price usd={item.livePrice} className="font-display font-extrabold" />
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
          <li>
            <Link href="/live/auction" data-tone="dark" className="group relative block overflow-hidden rounded-[24px]">
              <span className="relative block aspect-[3/4]">
                <Image src={auctionRoom.image} alt="" fill sizes="(min-width: 1100px) 260px, 50vw" className="object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
              </span>
              <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-black/30" />
              <span className="absolute top-2.5 left-2.5 flex items-center gap-1 rounded-full bg-live px-2 py-0.5 text-[10px] font-extrabold tracking-[0.06em]">LIVE AUCTION</span>
              <span className="absolute inset-x-2.5 bottom-2.5 flex flex-col gap-1.5 text-legible">
                <span className="text-[10.5px] font-bold tracking-[0.06em] text-white/75 uppercase">Auction</span>
                <span className="line-clamp-2 text-[13.5px] leading-snug font-bold">{lot.title}</span>
                <span className="flex items-center gap-1.5 text-[11px] font-semibold text-white/85">
                  <Icon name="gavel" className="size-3.5" />
                  <span className="truncate">{studio.name}</span>
                </span>
                <span className="text-[11px] font-semibold text-white/85">
                  Top bid <Price usd={lot.current} className="font-display font-extrabold text-white" />
                </span>
              </span>
            </Link>
          </li>
        </ul>
      </section>

      <section aria-labelledby="coming-up">
        <h2 id="coming-up" className="font-display text-2xl font-extrabold tracking-[-0.02em]">
          Coming up
        </h2>
        <p className="mb-3 text-sm text-ink-2">Set a reminder and we&apos;ll ping you when they go live.</p>
        <LiveSchedule shows={liveSchedule} />
      </section>

      <section aria-labelledby="replays">
        <h2 id="replays" className="mb-3 font-display text-2xl font-extrabold tracking-[-0.02em]">
          Replays you can still shop
        </h2>
        <ul className="no-scrollbar -mx-3.5 flex gap-2.5 overflow-x-auto px-3.5 lg:mx-0 lg:grid lg:grid-cols-3 lg:px-0">
          {liveReplays.map((r) => {
            const seller = getSeller(r.sellerId);
            return (
              <li key={r.id} className="w-[200px] shrink-0 lg:w-auto">
                <Link href={`/s/${r.sellerId}`} data-tone="dark" className="group relative block overflow-hidden rounded-[22px]">
                  <span className="relative block aspect-[4/5]">
                    <Image src={r.image} alt="" fill sizes="(min-width: 1100px) 340px, 200px" className="object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
                  </span>
                  <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-transparent to-transparent" />
                  <span className="absolute top-2.5 left-2.5 flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[10.5px] font-bold backdrop-blur-md">
                    <Icon name="play" filled className="size-3" />
                    {r.minutes} min
                  </span>
                  <span className="absolute inset-x-2.5 bottom-2.5 flex flex-col gap-1 text-legible">
                    <span className="line-clamp-2 text-[13px] leading-snug font-bold">{r.title}</span>
                    <span className="text-[11px] font-semibold text-white/80">
                      {seller.name} · {compact(r.views)} views · {r.products} products
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
