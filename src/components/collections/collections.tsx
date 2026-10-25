"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Icon } from "@/components/icon";
import { useMoney } from "@/components/price";
import { ProductCard } from "@/components/product/product-card";
import { rememberProducts, useProducts } from "@/components/product/use-products";
import { useStore } from "@/components/providers";
import { Sheet, type Detent } from "@/components/sheet";
import type { Product } from "@/lib/catalog";
import { compact, plural } from "@/lib/format";
import type { BoardView } from "@/modules/engagement";
import { createBoardAction, deleteBoardAction, editBoardAction, followBoardAction, setBoardItemAction } from "@/server/actions/boards";

type Covers = Record<string, string>;

/** Boards you made, boards you follow, and popular public boards. */
export function CollectionsScreen({ signedIn, mine, followed, popular, covers }: { signedIn: boolean; mine: BoardView[]; followed: BoardView[]; popular: BoardView[]; covers: Covers }) {
  const router = useRouter();
  const { saved } = useStore();
  const savedCovers = useProducts(saved.slice(0, 4)).products;
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState("");
  const [onlyMe, setOnlyMe] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const [follows, setFollows] = useState<Record<string, BoardView>>({});
  const others = popular.filter((b) => !b.yours).map((b) => follows[b.id] ?? b);
  const imageOf = (slug: string) => covers[slug] ?? savedCovers.find((p) => p.slug === slug)?.images[0];

  return (
    <div className="mx-auto max-w-[1000px] px-3.5 pt-safe pb-36 lg:px-6 lg:pt-6 lg:pb-16">
      <header className="flex items-center gap-3 pt-2 pb-4 lg:pt-0">
        <Link href="/me" aria-label="Back" className="glass grid size-11 shrink-0 place-items-center rounded-full lg:hidden">
          <Icon name="back" className="size-5" />
        </Link>
        <h1 className="flex-1 font-display text-[30px] font-extrabold tracking-[-0.03em]">Collections</h1>
        {signedIn ? (
          <button type="button" onClick={() => setNaming((v) => !v)} aria-expanded={naming} className="flex h-10 items-center gap-1.5 rounded-full bg-accent px-4 text-[13px] font-bold">
            <Icon name="plus" className="size-4" />
            New board
          </button>
        ) : (
          <Link href="/signin?next=/collections" className="flex h-10 items-center gap-1.5 rounded-full bg-accent px-4 text-[13px] leading-10 font-bold">
            Sign in to make boards
          </Link>
        )}
      </header>

      {naming && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!name.trim() || busy) return;
            start(async () => {
              const r = await createBoardAction(name, !onlyMe, null);
              if (!r.ok) return setError(r.message);
              router.push(`/collections/${r.board.id}`);
            });
          }}
          className="glass mb-4 flex flex-col gap-2 rounded-[24px] p-2 pl-4"
        >
          <div className="flex items-center gap-2">
            <label className="sr-only" htmlFor="board-name">
              Board name
            </label>
            <input id="board-name" autoFocus maxLength={60} value={name} onChange={(e) => setName(e.target.value)} placeholder="Name it, e.g. “New flat”" className="h-10 min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-ink-3" />
            <button type="submit" disabled={busy || !name.trim()} className="h-10 rounded-full bg-white px-4 text-sm font-bold text-black disabled:opacity-50">
              {busy ? "Creating…" : "Create"}
            </button>
          </div>
          <label className="flex items-center gap-2 pb-1 text-[13px] text-ink-2">
            <input type="checkbox" checked={onlyMe} onChange={(e) => setOnlyMe(e.target.checked)} className="size-4 accent-[var(--color-accent)]" />
            Only me (a private board can&apos;t be shared or followed)
          </label>
          {error && (
            <p role="alert" className="pb-1 text-[13px] text-like">
              {error}
            </p>
          )}
        </form>
      )}

      <h2 className="mb-3 px-1 text-[15px] font-bold">Your boards</h2>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <li>
          <BoardCard href="/collections/saved" name="All saved" note={plural(saved.length, "item")} images={savedCovers.map((p) => p.images[0])} />
        </li>
        {mine.map((b) => (
          <li key={b.id}>
            <BoardCard href={`/collections/${b.id}`} name={b.name} note={`${b.public ? "" : "Only you · "}${plural(b.slugs.length, "item")}`} images={b.slugs.slice(0, 4).flatMap((s) => imageOf(s) ?? [])} locked={!b.public} />
          </li>
        ))}
      </ul>
      {signedIn && mine.length === 0 && <p className="mt-3 px-1 text-[13px] text-ink-2">Make a board for a project or a trip, then add things from your saved list.</p>}

      {followed.length > 0 && (
        <>
          <h2 className="mt-8 mb-3 px-1 text-[15px] font-bold">Following</h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {followed.map((b) => (
              <li key={b.id}>
                <BoardCard href={`/collections/${b.id}`} name={b.name} note={`${b.ownerName} · ${plural(b.slugs.length, "item")}`} images={b.slugs.slice(0, 4).flatMap((s) => imageOf(s) ?? [])} />
              </li>
            ))}
          </ul>
        </>
      )}

      {others.length > 0 && (
        <>
          <h2 className="mt-8 mb-3 px-1 text-[15px] font-bold">Popular boards</h2>
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {others.map((b) => (
              <li key={b.id} className="flex flex-col gap-2">
                <BoardCard href={`/collections/${b.id}`} name={b.name} note={`${b.ownerName} · ${plural(b.slugs.length, "item")}`} images={b.slugs.slice(0, 4).flatMap((s) => imageOf(s) ?? [])} />
                <FollowButton board={b} signedIn={signedIn} onChange={(next) => setFollows((f) => ({ ...f, [next.id]: next }))} />
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function FollowButton({ board, signedIn, onChange, className = "h-9 w-full" }: { board: BoardView; signedIn: boolean; onChange: (b: BoardView) => void; className?: string }) {
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  if (!signedIn) {
    return (
      <Link href={`/signin?next=/collections/${board.id}`} className={`grid place-items-center rounded-full bg-white px-4 text-[13px] font-bold text-black ${className}`}>
        Follow{board.followers ? ` · ${compact(board.followers)}` : ""}
      </Link>
    );
  }
  return (
    <>
      <button
        type="button"
        aria-pressed={board.following}
        disabled={busy}
        onClick={() =>
          start(async () => {
            const r = await followBoardAction(board.id, !board.following);
            if (r.ok) onChange(r.board);
            else setError(r.message);
          })
        }
        className={`rounded-full px-4 text-[13px] font-bold ${board.following ? "glass-inset text-ink-2" : "bg-white text-black"} ${className}`}
      >
        {board.following ? "Following" : `Follow${board.followers ? ` · ${compact(board.followers)}` : ""}`}
      </button>
      {error && (
        <p role="alert" className="text-[12px] text-like">
          {error}
        </p>
      )}
    </>
  );
}

function Mosaic({ images, className = "" }: { images: string[]; className?: string }) {
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

function BoardCard({ href, name, note, images, locked }: { href: string; name: string; note: string; images: string[]; locked?: boolean }) {
  return (
    <Link href={href} className="block">
      <span className="relative block">
        <Mosaic images={images} className="aspect-square rounded-[24px]" />
        {locked && (
          <span className="glass absolute top-2 right-2 grid size-7 place-items-center rounded-full" aria-hidden>
            <Icon name="lock" className="size-3.5" />
          </span>
        )}
      </span>
      <span className="mt-2 block truncate px-1 text-[15px] font-semibold">{name}</span>
      <span className="block truncate px-1 text-xs text-ink-2">{note}</span>
    </Link>
  );
}

function BoardHeader({ title, sub, children }: { title: string; sub: string; children?: React.ReactNode }) {
  return (
    <header className="flex items-center gap-3 pt-2 pb-4 lg:pt-0">
      <Link href="/collections" aria-label="Back" className="glass grid size-11 shrink-0 place-items-center rounded-full">
        <Icon name="back" className="size-5" />
      </Link>
      <div className="min-w-0 flex-1">
        <h1 className="truncate font-display text-[26px] font-extrabold tracking-[-0.03em]">{title}</h1>
        <p className="truncate text-xs text-ink-2">{sub}</p>
      </div>
      {children}
    </header>
  );
}

function Grid({ products }: { products: Product[] }) {
  return (
    <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
      {products.map((p) => (
        <li key={p.slug}>
          <ProductCard product={p} sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw" />
        </li>
      ))}
    </ul>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="glass-inset mx-auto mt-6 flex max-w-sm flex-col items-center gap-3 rounded-[26px] p-6 text-center">
      <Icon name="bookmark" className="size-8 text-ink-2" />
      {children}
    </div>
  );
}

/** Everything you saved, on this device (and your account, when signed in). */
export function SavedBoardScreen() {
  const { saved, ready } = useStore();
  const { products, loading } = useProducts(saved);
  return (
    <div className="mx-auto max-w-[1000px] px-3.5 pt-safe pb-36 lg:px-6 lg:pt-6 lg:pb-16">
      <BoardHeader title="All saved" sub={`Only you · ${plural(saved.length, "item")}`} />
      {!ready || (loading && saved.length) ? (
        <div className="skeleton h-72 rounded-[26px]" />
      ) : products.length ? (
        <Grid products={products} />
      ) : (
        <Empty>
          <p className="text-sm text-ink-2">Nothing here yet. Tap Save in any video&apos;s shop sheet and it lands here.</p>
          <Link href="/" className="h-10 rounded-full bg-accent px-5 text-sm leading-10 font-bold">
            Browse the feed
          </Link>
        </Empty>
      )}
    </div>
  );
}

/** One board: the owner can add, remove, rename, hide or delete; anyone else can follow and share. */
export function BoardScreen({ initial, products: initialProducts, signedIn }: { initial: BoardView; products: Product[]; signedIn: boolean }) {
  const [board, setBoard] = useState(() => {
    rememberProducts(initialProducts);
    return initial;
  });
  const { products } = useProducts(board.slugs);
  const [copied, setCopied] = useState(false);
  const [sheet, setSheet] = useState<Detent>("closed");

  async function share() {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: board.name, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
      }
    } catch {
      // Share dismissed or clipboard blocked: nothing to do.
    }
  }

  const who = board.yours ? `Your board · ${board.public ? "Public" : "Only you"}` : `By ${board.ownerName}`;
  const followers = board.followers ? ` · ${plural(board.followers, "follower")}` : "";

  return (
    <div className="mx-auto max-w-[1000px] px-3.5 pt-safe pb-36 lg:px-6 lg:pt-6 lg:pb-16">
      <BoardHeader title={board.name} sub={`${who} · ${plural(board.slugs.length, "item")}${followers}`}>
        {board.public && (
          <button type="button" onClick={share} aria-label={copied ? "Link copied" : "Share"} className="glass flex h-10 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold">
            <Icon name={copied ? "check" : "share"} className="size-4" />
            <span className="max-sm:sr-only">{copied ? "Link copied" : "Share"}</span>
          </button>
        )}
        {board.yours && (
          <button type="button" onClick={() => setSheet("half")} className="flex h-10 items-center gap-1.5 rounded-full bg-accent px-4 text-[13px] font-bold">
            <Icon name="sliders" className="size-4" />
            Edit
          </button>
        )}
      </BoardHeader>

      {!board.yours && (
        <div className="mb-4 max-w-[220px]">
          <FollowButton board={board} signedIn={signedIn} onChange={setBoard} className="h-10 w-full" />
        </div>
      )}

      {products.length ? (
        <Grid products={products} />
      ) : (
        <Empty>
          {board.yours ? (
            <>
              <p className="text-sm text-ink-2">Nothing on this board yet. Add things you&apos;ve saved.</p>
              <button type="button" onClick={() => setSheet("half")} className="h-10 rounded-full bg-accent px-5 text-sm font-bold">
                Add items
              </button>
            </>
          ) : (
            <p className="text-sm text-ink-2">Nothing on this board yet.</p>
          )}
        </Empty>
      )}

      {board.yours && (
        <Sheet detent={sheet} onDetent={setSheet} label={`Edit ${board.name}`}>
          <EditBoard board={board} onChange={setBoard} onClose={() => setSheet("closed")} />
        </Sheet>
      )}
    </div>
  );
}

function EditBoard({ board, onChange, onClose }: { board: BoardView; onChange: (b: BoardView) => void; onClose: () => void }) {
  const router = useRouter();
  const money = useMoney();
  const { saved } = useStore();
  const [tab, setTab] = useState<"add" | "settings">("add");
  // What's on the board first, then saved things that aren't.
  const candidates = [...board.slugs, ...saved.filter((s) => !board.slugs.includes(s))];
  const { products, loading } = useProducts(candidates);
  const [name, setName] = useState(board.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const run = (fn: () => Promise<{ ok: true; board?: BoardView } | { ok: false; message: string }>, after?: () => void) =>
    start(async () => {
      const r = await fn();
      if (!r.ok) return setError(r.message);
      setError(null);
      if (r.board) onChange(r.board);
      after?.();
    });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 touch-none items-center gap-3 px-4 pt-1 pb-3">
        <div role="tablist" aria-label="Edit board" className="glass-inset flex flex-1 rounded-full p-1">
          {(["add", "settings"] as const).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`h-9 flex-1 rounded-full text-[13px] font-bold ${tab === t ? "bg-white text-black" : "text-ink-2"}`}>
              {t === "add" ? "Items" : "Settings"}
            </button>
          ))}
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="glass-inset grid size-9 place-items-center rounded-full">
          <Icon name="close" className="size-[18px]" />
        </button>
      </header>
      {error && (
        <p role="alert" className="px-4 pb-2 text-[13px] text-like">
          {error}
        </p>
      )}

      {tab === "add" ? (
        <ul data-sheet-scroll className="pb-safe flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-4">
          {!loading && products.length === 0 && <li className="py-6 text-center text-sm text-ink-2">Save things from the feed&apos;s shop sheet, then add them here.</li>}
          {products.map((p) => {
            const on = board.slugs.includes(p.slug);
            return (
              <li key={p.slug}>
                <button type="button" aria-pressed={on} disabled={busy} onClick={() => run(() => setBoardItemAction(board.id, p.slug, !on))} className="flex w-full items-center gap-3 rounded-2xl p-2 text-left hover:bg-white/5 disabled:opacity-70">
                  <Image src={p.images[0]} alt="" width={52} height={52} sizes="52px" className="size-[52px] rounded-xl object-cover" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{p.title}</span>
                    <span className="block text-xs text-ink-2">{p.price === undefined ? "Quote" : money(p.price)}</span>
                  </span>
                  <span className={`grid size-8 place-items-center rounded-full ${on ? "bg-white text-black" : "glass-inset text-ink-2"}`}>
                    <Icon name={on ? "check" : "plus"} className="size-4" />
                  </span>
                  <span className="sr-only">{on ? "On this board" : "Add"}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <div data-sheet-scroll className="pb-safe flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (name.trim() && name.trim() !== board.name) run(() => editBoardAction(board.id, { name }));
            }}
            className="glass-inset flex items-center gap-2 rounded-[20px] p-1.5 pl-4"
          >
            <label className="sr-only" htmlFor="rename-board">
              Board name
            </label>
            <input id="rename-board" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} className="h-10 min-w-0 flex-1 bg-transparent text-base outline-none" />
            <button type="submit" disabled={busy || !name.trim() || name.trim() === board.name} className="h-10 rounded-full bg-white px-4 text-sm font-bold text-black disabled:opacity-50">
              Rename
            </button>
          </form>
          <label className="glass-inset flex items-center gap-3 rounded-[20px] p-4">
            <span className="min-w-0 flex-1 text-sm">
              <b className="font-semibold">Public</b>
              <br />
              <span className="text-ink-2">{board.public ? "Anyone with the link can see and follow it." : "Only you can see it."}</span>
            </span>
            <input type="checkbox" role="switch" checked={board.public} disabled={busy} onChange={(e) => run(() => editBoardAction(board.id, { isPublic: e.target.checked }))} className="size-5 accent-[var(--color-accent)]" />
          </label>
          {confirmDelete ? (
            <div className="glass-inset flex flex-col gap-3 rounded-[20px] p-4">
              <p className="text-sm">Delete “{board.name}”? The products stay in your saved list.</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => setConfirmDelete(false)} className="glass h-10 flex-1 rounded-full text-sm font-semibold">
                  Keep it
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run(
                      () => deleteBoardAction(board.id),
                      () => {
                        router.push("/collections");
                        router.refresh();
                      },
                    )
                  }
                  className="h-10 flex-1 rounded-full bg-like text-sm font-bold text-white"
                >
                  Delete
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)} className="h-11 rounded-full text-sm font-semibold text-like">
              Delete board
            </button>
          )}
        </div>
      )}
    </div>
  );
}
