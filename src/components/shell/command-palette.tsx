"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Icon, type IconName } from "@/components/icon";
import { Flag } from "@/components/market/flag";
import { useStore } from "@/components/providers";
import { brand } from "@/config/brand";
import { useProductSearch, useSearchAll } from "@/components/search/use-product-search";
import { categories } from "@/lib/catalog";
import { isPaletteShortcut } from "./palette-shortcut";

type Command = { id: string; group: string; label: string; hint?: string; icon?: IconName; image?: string; flag?: string; href?: string; market?: string; glass?: number };

const pages: { label: string; href: string; icon: IconName; hint?: string }[] = [
  { label: "For You", href: "/", icon: "home" },
  { label: "Discover", href: "/discover", icon: "compass" },
  { label: "Live now", href: "/live", icon: "live" },
  { label: "Drops and 11.11", href: "/drops", icon: "bolt" },
  { label: "Rankings", href: "/rankings", icon: "trophy" },
  { label: "Compare", href: "/compare", icon: "compare" },
  { label: "Solar kit builder", href: "/energy", icon: "sun" },
  { label: "All categories", href: "/c", icon: "store" },
  { label: "Pick a blind box", href: "/unbox", icon: "cube" },
  { label: "Bag", href: "/checkout", icon: "bag" },
  { label: "Inbox", href: "/inbox", icon: "chat" },
  { label: "Rewards and coins", href: "/rewards", icon: "gift" },
  { label: "Coupons", href: "/coupons", icon: "card" },
  { label: "Collections", href: "/collections", icon: "bookmark" },
  { label: "Creator hub", href: "/creator", icon: "sparkle" },
  { label: "Business and bulk", href: "/business", icon: "factory" },
  { label: "Me", href: "/me", icon: "user" },
];

const NO_FILTERS = {};

const glassLevels = [
  { label: "Clear", value: 10 },
  { label: "Regular", value: 40 },
  { label: "Frosted", value: 70 },
  { label: "Tinted", value: 95 },
];

/** Loose match: every letter of the query appears in order, so "rnk" finds Rankings. */
function fuzzy(text: string, query: string) {
  let i = 0;
  const t = text.toLowerCase();
  for (const ch of query.toLowerCase()) {
    i = t.indexOf(ch, i);
    if (i < 0) return false;
    i += 1;
  }
  return true;
}

/**
 * Jump to any page, product, seller or setting. Loaded on first use by <CommandPaletteLoader>,
 * which opens it straight away (`openOnMount`); after that it listens for the shortcut itself.
 */
export function CommandPalette({ openOnMount = false }: { openOnMount?: boolean }) {
  const router = useRouter();
  const { markets, setMarket, setGlass } = useStore();
  const dialog = useRef<HTMLDialogElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const id = useId();

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (isPaletteShortcut(e)) {
        e.preventDefault();
        open();
      }
    }
    const open = () => {
      if (!dialog.current?.open) dialog.current?.showModal();
    };
    if (openOnMount) open();
    window.addEventListener("keydown", onKey);
    window.addEventListener("app:palette", open);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("app:palette", open);
    };
    // Opening on mount is a one-off; later opens come from the listeners.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function close() {
    dialog.current?.close();
  }

  function run(c: Command) {
    close();
    if (c.href) router.push(c.href);
    if (c.market) setMarket(c.market);
    if (c.glass !== undefined) setGlass(c.glass);
  }

  const q = query.trim();
  // Products and shops come from the server search, debounced as you type.
  const { products } = useProductSearch(q, NO_FILTERS, "best", q !== "");
  const { shops } = useSearchAll(q);
  const commands: Command[] = [];
  if (q) {
    commands.push({ id: "ask", group: "Ask", label: `Ask ${brand.name}: “${q}”`, icon: "sparkle", hint: "Agent", href: `/ask?q=${encodeURIComponent(q)}` });
    commands.push({ id: "search", group: "Ask", label: `Search for “${q}”`, icon: "search", href: `/search?q=${encodeURIComponent(q)}` });
  }
  for (const p of pages) if (!q || fuzzy(p.label, q)) commands.push({ id: p.href, group: "Go to", label: p.label, icon: p.icon, href: p.href });
  if (q) {
    for (const p of products.slice(0, 5)) commands.push({ id: `p-${p.slug}`, group: "Products", label: p.title, image: p.images[0], href: `/p/${p.slug}` });
    for (const s of shops.slice(0, 3)) commands.push({ id: `s-${s.id}`, group: "Sellers", label: s.name, hint: s.city, image: s.avatar, href: `/s/${s.id}` });
    for (const c of categories.filter((c) => fuzzy(c.label, q)).slice(0, 3)) commands.push({ id: `c-${c.id}`, group: "Categories", label: c.label, image: c.image, href: `/c/${c.id}` });
    for (const m of markets.filter((m) => m.name.toLowerCase().includes(q.toLowerCase()) || m.currency.toLowerCase() === q.toLowerCase()).slice(0, 3))
      commands.push({ id: `m-${m.code}`, group: "Settings", label: `Ship to ${m.name}`, hint: m.currency, flag: m.code, market: m.code });
    for (const g of glassLevels.filter((g) => fuzzy(`glass ${g.label}`, q))) commands.push({ id: `g-${g.label}`, group: "Settings", label: `Liquid Glass: ${g.label}`, icon: "eye", glass: g.value });
  }
  const current = Math.min(active, commands.length - 1);
  const groups = [...new Set(commands.map((c) => c.group))];

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const next = (current + (e.key === "ArrowDown" ? 1 : -1) + commands.length) % commands.length;
      setActive(next);
      list.current?.querySelector(`[data-index="${next}"]`)?.scrollIntoView({ block: "nearest" });
    } else if (e.key === "Enter" && commands[current]) {
      e.preventDefault();
      run(commands[current]);
    }
  }

  return (
    <dialog
      ref={dialog}
      aria-label="Command palette"
      onClose={() => {
        setQuery("");
        setActive(0);
      }}
      onClick={(e) => e.target === dialog.current && close()}
      className="m-0 mx-auto mt-[12vh] w-[min(640px,calc(100vw-24px))] max-w-none overflow-visible bg-transparent p-0 text-ink backdrop:bg-black/55 backdrop:backdrop-blur-sm"
    >
      <div className="glass-sheet flex max-h-[70vh] flex-col overflow-hidden rounded-[28px] motion-safe:animate-rise">
        <div className="flex items-center gap-3 border-b border-line px-4">
          <Icon name="search" className="size-5 text-ink-2" />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={onKeyDown}
            role="combobox"
            aria-expanded="true"
            aria-controls={`${id}-list`}
            aria-activedescendant={commands[current] ? `${id}-${current}` : undefined}
            placeholder="Jump to a page, product, seller or setting"
            className="h-14 min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-ink-3"
          />
          <kbd className="rounded-md bg-white/10 px-1.5 py-0.5 text-[11px] font-semibold text-ink-2">Esc</kbd>
        </div>
        <ul ref={list} id={`${id}-list`} role="listbox" className="no-scrollbar min-h-0 flex-1 overflow-y-auto p-2">
          {commands.length === 0 && <li className="px-3 py-8 text-center text-sm text-ink-2">Nothing matches. Try a product, a seller or a page.</li>}
          {groups.map((g) => (
            <li key={g} role="presentation">
              <p className="px-3 pt-2 pb-1 text-[11px] font-bold tracking-[0.1em] text-ink-3 uppercase">{g}</p>
              <ul role="presentation">
                {commands
                  .map((c, i) => ({ c, i }))
                  .filter(({ c }) => c.group === g)
                  .map(({ c, i }) => (
                    <li
                      key={c.id}
                      id={`${id}-${i}`}
                      data-index={i}
                      role="option"
                      aria-selected={i === current}
                      onMouseMove={() => setActive(i)}
                      onClick={() => run(c)}
                      className={`flex h-12 cursor-pointer items-center gap-3 rounded-2xl px-3 text-[14.5px] ${i === current ? "bg-white/12" : ""}`}
                    >
                      {c.image ? (
                        <Image src={c.image} alt="" width={30} height={30} sizes="30px" className="size-[30px] rounded-lg object-cover" />
                      ) : c.flag ? (
                        <Flag code={c.flag} className="size-[26px]" />
                      ) : (
                        <span className="grid size-[30px] place-items-center rounded-lg bg-white/[0.07]">
                          <Icon name={c.icon ?? "forward"} className={`size-[18px] ${c.icon === "sparkle" ? "text-agent" : "text-ink-2"}`} />
                        </span>
                      )}
                      <span className="min-w-0 flex-1 truncate font-medium">{c.label}</span>
                      {c.hint && <span className="shrink-0 text-xs text-ink-3">{c.hint}</span>}
                      {i === current && <Icon name="forward" className="size-4 shrink-0 text-ink-3" />}
                    </li>
                  ))}
              </ul>
            </li>
          ))}
        </ul>
        <p className="flex items-center gap-3 border-t border-line px-4 py-2.5 text-[11px] text-ink-3">
          <span>
            <kbd className="font-semibold text-ink-2">↑ ↓</kbd> to move
          </span>
          <span>
            <kbd className="font-semibold text-ink-2">Enter</kbd> to open
          </span>
          <span className="ml-auto">
            <kbd className="font-semibold text-ink-2">⌘K</kbd> anywhere
          </span>
        </p>
      </div>
    </dialog>
  );
}
