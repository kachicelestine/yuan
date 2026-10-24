"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/icon";
import { ProductCard } from "@/components/product/product-card";
import { useStore } from "@/components/providers";
import { boards as fixtureBoards } from "@/lib/account";
import { getProduct, type Board } from "@/lib/catalog";
import { compact, plural } from "@/lib/format";
import { useStored } from "@/lib/use-stored";

/** Your boards plus "All saved", and popular boards from creators. */
function useBoards() {
  const { saved } = useStore();
  const [mine, setMine] = useStored<Board[]>("app.boards", []);
  const savedBoard: Board = { id: "saved", name: "All saved", owner: "You", ownerAvatar: "", slugs: saved };
  const own = [savedBoard, ...fixtureBoards.filter((b) => b.owner === "You"), ...mine];
  const popular = fixtureBoards.filter((b) => b.owner !== "You");
  return { own, popular, mine, setMine };
}

export function CollectionsScreen() {
  const { own, popular, mine, setMine } = useBoards();
  const [following, setFollowing] = useStored<string[]>("app.boards-following", []);
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");

  return (
    <div className="mx-auto max-w-[1000px] px-3.5 pt-safe pb-36 lg:px-6 lg:pt-6 lg:pb-16">
      <header className="flex items-center gap-3 pt-2 pb-4 lg:pt-0">
        <Link href="/me" aria-label="Back" className="glass grid size-11 shrink-0 place-items-center rounded-full lg:hidden">
          <Icon name="back" className="size-5" />
        </Link>
        <h1 className="flex-1 font-display text-[30px] font-extrabold tracking-[-0.03em]">Collections</h1>
        <button type="button" onClick={() => setNaming(true)} className="flex h-10 items-center gap-1.5 rounded-full bg-accent px-4 text-[13px] font-bold">
          <Icon name="plus" className="size-4" />
          New board
        </button>
      </header>

      {naming && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const n = name.trim();
            if (!n) return;
            setMine([...mine, { id: `b-${mine.length + 1}-${n.toLowerCase().replace(/\W+/g, "-")}`, name: n, owner: "You", ownerAvatar: "", slugs: [] }]);
            setName("");
            setNaming(false);
          }}
          className="glass mb-4 flex items-center gap-2 rounded-[24px] p-2 pl-4"
        >
          <label className="sr-only" htmlFor="board-name">
            Board name
          </label>
          <input id="board-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Name it, e.g. “New flat”" className="h-10 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-ink-3" />
          <button type="submit" className="h-10 rounded-full bg-white px-4 text-sm font-bold text-black">
            Create
          </button>
        </form>
      )}

      <h2 className="mb-3 px-1 text-[15px] font-bold">Your boards</h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {own.map((b) => (
          <li key={b.id}>
            <BoardCard board={b} />
          </li>
        ))}
      </ul>

      <h2 className="mt-8 mb-3 px-1 text-[15px] font-bold">Popular boards</h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {popular.map((b) => {
          const on = following.includes(b.id);
          return (
            <li key={b.id} className="flex flex-col gap-2">
              <BoardCard board={b} />
              <button
                type="button"
                onClick={() => setFollowing(on ? following.filter((id) => id !== b.id) : [...following, b.id])}
                className={`h-9 rounded-full text-[13px] font-bold ${on ? "glass-inset text-ink-2" : "bg-white text-black"}`}
              >
                {on ? "Following" : `Follow · ${compact((b.followers ?? 0) + (on ? 1 : 0))}`}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Mosaic({ slugs, className = "" }: { slugs: string[]; className?: string }) {
  const images = slugs.map((s) => getProduct(s)?.images[0]).filter(Boolean).slice(0, 4) as string[];
  return (
    <span className={`grid grid-cols-2 grid-rows-2 gap-0.5 overflow-hidden bg-white/[0.06] ${className}`}>
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className="relative bg-white/[0.04]">
          {images[i] && <Image src={images[i]} alt="" fill sizes="120px" className="object-cover" />}
        </span>
      ))}
    </span>
  );
}

function BoardCard({ board }: { board: Board }) {
  return (
    <Link href={`/collections/${board.id}`} className="block">
      <Mosaic slugs={board.slugs} className="aspect-square rounded-[24px]" />
      <span className="mt-2 block truncate px-1 text-[15px] font-semibold">{board.name}</span>
      <span className="flex items-center gap-1.5 px-1 text-xs text-ink-2">
        {board.ownerAvatar && <Image src={board.ownerAvatar} alt="" width={16} height={16} sizes="16px" className="size-4 rounded-full object-cover" />}
        {board.owner === "You" ? plural(board.slugs.length, "item") : `${board.owner} · ${plural(board.slugs.length, "item")}`}
      </span>
    </Link>
  );
}

export function BoardScreen({ id }: { id: string }) {
  const { own, popular } = useBoards();
  const board = [...own, ...popular].find((b) => b.id === id);
  const [copied, setCopied] = useState(false);
  if (!board) return <p className="pt-safe p-8 text-center text-ink-2">This board was deleted or never existed.</p>;
  const items = board.slugs.map((s) => getProduct(s)).filter(Boolean);

  return (
    <div className="mx-auto max-w-[1000px] px-3.5 pt-safe pb-36 lg:px-6 lg:pt-6 lg:pb-16">
      <header className="flex items-center gap-3 pt-2 pb-4 lg:pt-0">
        <Link href="/collections" aria-label="Back" className="glass grid size-11 shrink-0 place-items-center rounded-full">
          <Icon name="back" className="size-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-[26px] font-extrabold tracking-[-0.03em]">{board.name}</h1>
          <p className="text-xs text-ink-2">
            {board.owner === "You" ? "Your board" : `By ${board.owner}`} · {plural(items.length, "item")}
          </p>
        </div>
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(window.location.href);
              setCopied(true);
            } catch {
              // Clipboard blocked: nothing to do.
            }
          }}
          className="glass flex h-10 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold"
        >
          <Icon name={copied ? "check" : "share"} className="size-4" />
          {copied ? "Link copied" : "Share"}
        </button>
      </header>
      {items.length ? (
        <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
          {items.map((p) => (
            <li key={p!.slug}>
              <ProductCard product={p!} sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw" />
            </li>
          ))}
        </ul>
      ) : (
        <div className="glass-inset mx-auto mt-6 flex max-w-sm flex-col items-center gap-3 rounded-[26px] p-6 text-center">
          <Icon name="bookmark" className="size-8 text-ink-2" />
          <p className="text-sm text-ink-2">Nothing here yet. Tap Save in any video&apos;s shop sheet and it lands in All saved.</p>
          <Link href="/" className="h-10 rounded-full bg-accent px-5 text-sm leading-10 font-bold">
            Browse the feed
          </Link>
        </div>
      )}
    </div>
  );
}
