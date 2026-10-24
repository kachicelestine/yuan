"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Icon, VerifiedBadge } from "@/components/icon";
import { useMoney } from "@/components/price";
import { categories, getSellerProfile, type CategoryId } from "@/lib/catalog";
import { boards, periods, rankProducts, rankSellers, type BoardId, type Move, type Period, type RankedProduct, type RankedSeller } from "@/lib/rankings";

const medals = ["#ffc53d", "#d5dae3", "#e0935f"];
const shelves = categories.filter((c) => !["toys", "smarthome", "textiles"].includes(c.id));

/** Leaderboards: best sellers, most saved, top rated and rising factories, by window and category. */
export function RankingsScreen() {
  const [board, setBoard] = useState<BoardId>("hot");
  const [period, setPeriod] = useState<Period>("week");
  const [category, setCategory] = useState<CategoryId | undefined>();
  const rows: (RankedProduct | RankedSeller)[] = board === "factories" ? rankSellers(period, category) : rankProducts(board, period, category);
  const meta = boards.find((b) => b.id === board)!;

  return (
    <div className="mx-auto max-w-[1000px] px-3.5 pt-safe pb-36 lg:px-6 lg:pt-6 lg:pb-16">
      <header className="relative -mx-3.5 overflow-hidden px-3.5 pt-3 pb-4 lg:mx-0 lg:rounded-[32px] lg:px-6 lg:pt-6">
        <span aria-hidden="true" className="absolute -top-24 left-1/2 size-[360px] -translate-x-1/2 rounded-full bg-save/20 blur-[90px]" />
        <div className="relative flex items-center gap-3">
          <Link href="/discover" aria-label="Back" className="glass grid size-11 shrink-0 place-items-center rounded-full lg:hidden">
            <Icon name="back" className="size-5" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 text-xs font-bold tracking-[0.1em] text-save">
              <Icon name="trophy" className="size-4" />
              UPDATED 12 MIN AGO
            </p>
            <h1 className="font-display text-[34px] leading-tight font-extrabold tracking-[-0.03em]">Rankings</h1>
          </div>
        </div>

        <div role="tablist" aria-label="Board" className="no-scrollbar glass relative mt-3 flex gap-1 overflow-x-auto rounded-full p-1">
          {boards.map((b) => (
            <button
              key={b.id}
              type="button"
              role="tab"
              aria-selected={board === b.id}
              onClick={() => setBoard(b.id)}
              className={`h-10 shrink-0 grow rounded-full px-3.5 text-[13.5px] font-semibold whitespace-nowrap transition-colors ${board === b.id ? "bg-white text-black" : "text-ink-2 hover:text-ink"}`}
            >
              {b.label}
            </button>
          ))}
        </div>

        <div className="relative mt-3 flex items-center gap-1.5">
          {periods.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={period === p.id}
              onClick={() => setPeriod(p.id)}
              className={`h-8 shrink-0 rounded-full px-3 text-[12.5px] font-semibold whitespace-nowrap transition-colors ${period === p.id ? "bg-save/20 text-save ring-1 ring-save/40" : "text-ink-2 hover:text-ink"}`}
            >
              {p.label}
            </button>
          ))}
          <span className="ml-auto hidden min-w-0 truncate text-xs text-ink-3 sm:block">{meta.blurb}</span>
        </div>

        <div role="group" aria-label="Category" className="no-scrollbar relative -mx-3.5 mt-3 flex gap-1.5 overflow-x-auto px-3.5 lg:mx-0 lg:px-0">
          {[{ id: undefined, label: "Everything" }, ...shelves].map((c) => (
            <button
              key={c.label}
              type="button"
              aria-pressed={category === c.id}
              onClick={() => setCategory(c.id)}
              className={`h-9 shrink-0 rounded-full px-3.5 text-[13px] font-semibold transition-colors ${category === c.id ? "bg-white text-black" : "glass-inset text-ink-2 hover:text-ink"}`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </header>

      {rows.length === 0 ? (
        <p className="glass rounded-[26px] p-6 text-center text-sm text-ink-2">Not enough sales in this category yet. Try another window or category.</p>
      ) : (
        <div key={`${board}-${period}-${category}`} className="flex animate-unfurl flex-col gap-3">
          <ol className="grid grid-cols-2 gap-2.5 lg:grid-cols-3">
            {rows.slice(0, 3).map((r, i) => (
              <li key={r.kind === "product" ? r.product.slug : r.seller.id} className={i === 0 ? "col-span-2 lg:col-span-1" : ""}>
                <Podium row={r} rank={i + 1} wide={i === 0} />
              </li>
            ))}
          </ol>
          <ol start={4} className="glass flex flex-col divide-y divide-line rounded-[26px] px-3">
            {rows.slice(3).map((r, i) => (
              <li key={r.kind === "product" ? r.product.slug : r.seller.id}>
                <Row row={r} rank={i + 4} />
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function MoveTag({ move }: { move: Move }) {
  if (move === null) return <span className="rounded-full bg-agent/15 px-1.5 py-px text-[9.5px] font-extrabold tracking-wide text-agent">NEW</span>;
  if (move === 0)
    return (
      <span aria-label="No change" className="text-[11px] text-ink-3">
        –
      </span>
    );
  return (
    <span aria-label={`${move > 0 ? "Up" : "Down"} ${Math.abs(move)}`} className={`flex items-center text-[11px] font-bold ${move > 0 ? "text-positive" : "text-like"}`}>
      <Icon name={move > 0 ? "up" : "down"} className="size-3" />
      {Math.abs(move)}
    </span>
  );
}

function Podium({ row, rank, wide }: { row: RankedProduct | RankedSeller; rank: number; wide: boolean }) {
  const money = useMoney();
  const href = row.kind === "product" ? `/p/${row.product.slug}` : `/s/${row.seller.id}`;
  const image = row.kind === "product" ? row.product.images[0] : (getSellerProfile(row.seller.id)?.cover ?? row.seller.avatar);
  const title = row.kind === "product" ? row.product.title : row.seller.name;

  return (
    <Link href={href} className="group glass relative block overflow-hidden rounded-[26px]" style={{ boxShadow: `inset 0 0 0 1.5px ${medals[rank - 1]}66` }}>
      <span data-tone="dark" className={`relative block overflow-hidden ${wide ? "aspect-[16/10] lg:aspect-[4/5]" : "aspect-[4/5]"}`}>
        <Image src={image} alt="" fill loading={rank === 1 ? "eager" : undefined} sizes={wide ? "(min-width: 1000px) 320px, 100vw" : "(min-width: 1000px) 320px, 50vw"} className="object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
        <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
        <span className="absolute top-2.5 left-3 font-display text-[54px] leading-none font-black tracking-[-0.06em] drop-shadow-[0_2px_10px_rgb(0_0_0/0.55)]" style={{ color: medals[rank - 1] }}>
          {rank}
        </span>
        <span className="absolute top-3 right-3 flex h-7 items-center rounded-full bg-black/55 px-2 ring-1 ring-white/15 backdrop-blur-md">
          <MoveTag move={row.move} />
        </span>
        <span className="absolute inset-x-3 bottom-3">
          {row.kind === "seller" && (
            <span className="mb-1.5 flex items-center gap-1.5">
              <Image src={row.seller.avatar} alt="" width={28} height={28} sizes="28px" className="size-7 rounded-lg object-cover ring-2 ring-white/30" />
              {row.seller.verified && <VerifiedBadge className="size-4" />}
            </span>
          )}
          <span className={`line-clamp-2 leading-snug font-semibold text-legible ${wide ? "text-[17px]" : "text-[13.5px]"}`}>{title}</span>
          <span className="mt-1 flex items-baseline gap-2 text-legible">
            <b className={`font-display font-extrabold ${wide ? "text-xl" : "text-base"}`} style={{ color: medals[rank - 1] }}>
              {row.metric}
            </b>
            {row.kind === "product" && <span className="text-xs font-semibold text-white/80">{row.product.price === undefined ? "Quote" : money(row.product.price)}</span>}
          </span>
        </span>
      </span>
    </Link>
  );
}

function Row({ row, rank }: { row: RankedProduct | RankedSeller; rank: number }) {
  const money = useMoney();
  if (row.kind === "seller") {
    return (
      <Link href={`/s/${row.seller.id}`} className="flex items-center gap-3 py-3">
        <span className="flex w-7 shrink-0 flex-col items-center gap-0.5">
          <span className="font-display text-lg leading-none font-extrabold text-ink-2 tabular-nums">{rank}</span>
          <MoveTag move={row.move} />
        </span>
        <Image src={row.seller.avatar} alt="" width={48} height={48} sizes="48px" className="size-12 shrink-0 rounded-2xl object-cover" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1 text-sm font-semibold">
            <span className="truncate">{row.seller.name}</span>
            {row.seller.verified && <VerifiedBadge className="size-3.5" />}
          </span>
          <span className="block truncate text-xs text-ink-2">{row.detail}</span>
        </span>
        <span className="hidden gap-1 sm:flex">
          {row.picks.map((p) => (
            <Image key={p.slug} src={p.images[0]} alt="" width={36} height={36} sizes="36px" className="size-9 rounded-lg object-cover" />
          ))}
        </span>
        <b className="w-14 shrink-0 text-right font-display text-sm font-bold text-positive">{row.metric}</b>
      </Link>
    );
  }
  const p = row.product;
  return (
    <Link href={`/p/${p.slug}`} className="flex items-center gap-3 py-3">
      <span className="flex w-7 shrink-0 flex-col items-center gap-0.5">
        <span className="font-display text-lg leading-none font-extrabold text-ink-2 tabular-nums">{rank}</span>
        <MoveTag move={row.move} />
      </span>
      <Image src={p.images[0]} alt="" width={56} height={56} sizes="56px" className="size-14 shrink-0 rounded-2xl object-cover" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold">{p.title}</span>
        <span className="block text-xs text-ink-2">
          <b className="font-semibold text-ink">{row.metric}</b> · {row.detail}
        </span>
      </span>
      <span className="shrink-0 font-display text-sm font-bold">{p.price === undefined ? "Quote" : money(p.price)}</span>
    </Link>
  );
}
