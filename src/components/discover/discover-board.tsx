"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Icon, type IconName } from "@/components/icon";
import { useMoney } from "@/components/price";
import type { CategoryId, Note, Product } from "@/lib/catalog";
import { compact } from "@/lib/format";
import { capDensity } from "@/lib/images";

export type BoardNote = Note & { product?: Pick<Product, "slug" | "title" | "price"> };

const tools: { href: string; label: string; detail: string; icon: IconName; tint: string }[] = [
  { href: "/rankings", label: "Rankings", detail: "Selling now", icon: "trophy", tint: "bg-save/15 text-save" },
  { href: "/c#towns-h", label: "Factory towns", detail: "At the source", icon: "factory", tint: "bg-accent-light/15 text-accent-light" },
  { href: "/energy", label: "Solar kit", detail: "From your bill", icon: "sun", tint: "bg-positive/15 text-positive" },
  { href: "/compare", label: "Compare", detail: "Side by side", icon: "compare", tint: "bg-series/15 text-series" },
];

const ratioClass: Record<Note["ratio"], string> = { tall: "aspect-[3/4]", square: "aspect-square", wide: "aspect-[4/3]" };

export function DiscoverBoard({ notes, categories }: { notes: BoardNote[]; categories: { id: CategoryId; label: string }[] }) {
  const money = useMoney();
  const [category, setCategory] = useState<CategoryId | "all">("all");
  const [liked, setLiked] = useState<Record<string, boolean>>({});

  const visible = notes.filter((n) => category === "all" || n.category === category);

  return (
    <>
      <div className="sticky top-0 z-20 -mx-3.5 border-b border-line bg-canvas/70 px-3.5 pt-safe pb-3 backdrop-blur-2xl lg:-mx-6 lg:px-6 lg:pt-5">
        <div className="flex items-center justify-between gap-3 pt-2 lg:pt-0">
          <h1 className="font-display text-[34px] font-extrabold tracking-[-0.03em]">Discover</h1>
          <div className="flex items-center gap-2">
            <Link href="/live" className="glass flex h-10 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold">
              <span className="size-1.5 rounded-full bg-like" />
              Live now
            </Link>
            <Link href="/inbox" aria-label="Inbox, 3 unread chats" className="glass relative grid size-10 place-items-center rounded-full lg:hidden">
              <Icon name="chat" className="size-5" />
              <span className="absolute -top-0.5 -right-0.5 grid size-[18px] place-items-center rounded-full bg-accent text-[10px] font-bold">3</span>
            </Link>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 lg:hidden">
          <Link href="/search" className="glass flex h-12 min-w-0 flex-1 items-center gap-2.5 rounded-full px-4 text-[15px] text-ink-3">
            <Icon name="search" className="size-5 text-ink-2" />
            Search anything made in China
          </Link>
          <Link href="/search?snap=1" aria-label="Search with a photo" className="glass grid size-12 shrink-0 place-items-center rounded-full">
            <Icon name="camera" className="size-5" />
          </Link>
        </div>
        <div role="group" aria-label="Topics" className="no-scrollbar -mx-3.5 mt-3 flex gap-1.5 overflow-x-auto px-3.5 lg:mx-0 lg:px-0">
          {[{ id: "all" as const, label: "For you" }, ...categories].map((c) => (
            <button
              key={c.id}
              type="button"
              aria-pressed={category === c.id}
              onClick={() => setCategory(c.id)}
              className={`h-9 shrink-0 rounded-full px-3.5 text-[13.5px] font-semibold transition-colors ${category === c.id ? "bg-white text-black" : "glass-inset text-ink-2 hover:text-ink"}`}
            >
              {c.label}
            </button>
          ))}
          <Link href="/c" className="glass-inset flex h-9 shrink-0 items-center gap-1 rounded-full px-3.5 text-[13.5px] font-semibold text-ink-2 hover:text-ink">
            All categories
            <Icon name="forward" className="size-3.5" />
          </Link>
        </div>
      </div>

      {category === "all" && (
        <nav aria-label="Tools" className="no-scrollbar -mx-3.5 mt-3 flex gap-2 overflow-x-auto px-3.5 lg:mx-0 lg:grid lg:grid-cols-4 lg:px-0">
          {tools.map((t) => (
            <Link key={t.href} href={t.href} className="glass flex w-[118px] shrink-0 flex-col gap-2 rounded-[20px] p-3 lg:w-auto lg:flex-row lg:items-center lg:gap-2.5 lg:p-2.5">
              <span className={`grid size-9 shrink-0 place-items-center rounded-[12px] lg:size-10 lg:rounded-[14px] ${t.tint}`}>
                <Icon name={t.icon} className="size-5" />
              </span>
              <span className="min-w-0">
                <b className="block truncate text-[13px] font-semibold">{t.label}</b>
                <span className="block truncate text-[11px] text-ink-2">{t.detail}</span>
              </span>
            </Link>
          ))}
        </nav>
      )}

      <div className="mt-3 columns-2 gap-2 sm:columns-3 lg:columns-4 2xl:columns-5">
        {visible.map((note, i) => {
          const href = note.live ? "/live" : note.product ? `/p/${note.product.slug}` : undefined;
          const on = !!liked[note.id];
          const media = (
            <>
              <span data-tone="light" className={`relative block overflow-hidden ${ratioClass[note.ratio]}`}>
                <Image src={note.image} alt="" fill loading={i < 2 ? "eager" : undefined} fetchPriority={i < 2 ? "high" : undefined} sizes={capDensity("(min-width: 1024px) 25vw, 50vw")} className="object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
                {note.live && (
                  <span className="absolute top-2 left-2 flex h-6 items-center gap-1.5 rounded-full bg-live px-2 text-[10.5px] font-extrabold tracking-[0.08em]">
                    <span className="size-1.5 rounded-full bg-white" />
                    LIVE
                  </span>
                )}
                {note.video && (
                  <span className="glass absolute top-2 right-2 grid size-[30px] place-items-center rounded-full" aria-label="Video">
                    <Icon name="play" filled className="ml-0.5 size-3" />
                  </span>
                )}
                {note.product?.price && (
                  <span className="glass absolute bottom-2 left-2 flex h-7 items-center gap-1 rounded-full px-2.5 text-xs font-bold">
                    <Icon name="bag" className="size-3.5" />
                    {money(note.product.price)}
                  </span>
                )}
              </span>
              <span className="line-clamp-2 px-2.5 pt-2 text-[13.5px] leading-snug font-semibold text-pretty">{note.title}</span>
            </>
          );
          return (
            <article key={note.id} className="group mb-2 break-inside-avoid overflow-hidden rounded-[18px] bg-surface ring-[0.5px] ring-white/10">
              {href ? <Link href={href} className="block">{media}</Link> : media}
              <div className="flex h-11 items-center gap-1.5 pr-1 pl-2.5">
                <Image src={note.authorAvatar} alt="" width={20} height={20} sizes="20px" className="size-5 rounded-full object-cover" />
                <span className="min-w-0 flex-1 truncate text-xs text-ink-2">{note.authorName}</span>
                <button
                  type="button"
                  aria-label="Like"
                  aria-pressed={on}
                  onClick={() => setLiked((l) => ({ ...l, [note.id]: !l[note.id] }))}
                  className={`flex h-11 items-center gap-1 px-1.5 text-xs ${on ? "text-like" : "text-ink-2"}`}
                >
                  <Icon name="heart" filled={on} className={`size-[17px] ${on ? "motion-safe:animate-pop" : ""}`} />
                  {compact(note.likes + (on ? 1 : 0))}
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {visible.length === 0 && (
        <p className="mt-16 text-center text-sm text-ink-2">
          No notes in this topic yet.{" "}
          <button type="button" className="font-semibold text-ink underline" onClick={() => setCategory("all")}>
            See everything
          </button>
          .
        </p>
      )}
    </>
  );
}

