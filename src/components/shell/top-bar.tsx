"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { InboxBadge } from "@/components/shell/unread";
import { Icon } from "@/components/icon";
import { ShipTo } from "@/components/market/ship-to";
import { useStore } from "@/components/providers";
import { brand } from "@/config/brand";

export function BrandMark({ size = "md" }: { size?: "sm" | "md" }) {
  return (
    <Link href="/" aria-label={`${brand.name} home`} className="flex items-center gap-2.5">
      <span className={`seal grid place-items-center rounded-xl bg-accent text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.35)] ${size === "sm" ? "size-9 text-lg" : "size-10 text-[19px]"}`}>
        {brand.seal}
      </span>
      <span className="font-display text-[23px] font-extrabold tracking-[-0.03em] lowercase">{brand.name}</span>
    </Link>
  );
}

export function TopBar() {
  const router = useRouter();
  const { cartCount } = useStore();

  function onSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const q = new FormData(event.currentTarget).get("q")?.toString().trim();
    router.push(q ? `/search?q=${encodeURIComponent(q)}` : "/search");
  }

  return (
    <header className="z-30 hidden items-center gap-5 border-b border-line bg-canvas/50 px-6 backdrop-blur-2xl lg:col-span-2 lg:flex">
      <BrandMark />
      <form role="search" onSubmit={onSearch} className="glass mx-auto flex h-12 w-full max-w-[640px] items-center gap-2.5 rounded-full pr-1.5 pl-[18px]">
        <Icon name="search" className="size-5 text-ink-2" />
        <label htmlFor="top-search" className="sr-only">
          Search
        </label>
        <input
          id="top-search"
          name="q"
          type="search"
          placeholder="Search products, factories and creators"
          className="h-11 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-ink-3"
        />
        <button type="button" onClick={() => window.dispatchEvent(new Event("app:palette"))} aria-label="Open the command palette" className="hidden h-7 items-center rounded-md bg-white/10 px-2 text-[11px] font-semibold text-ink-2 ring-1 ring-white/10 xl:flex">
          ⌘K
        </button>
        <button
          type="button"
          onClick={(e) => {
            const q = (e.currentTarget.form?.elements.namedItem("q") as HTMLInputElement | null)?.value.trim();
            router.push(q ? `/ask?q=${encodeURIComponent(q)}` : "/ask");
          }}
          className="flex h-9 items-center gap-1.5 rounded-full bg-white/10 px-3.5 text-[13px] font-semibold ring-1 ring-white/20 ring-inset"
        >
          <Icon name="sparkle" className="size-4 text-agent" />
          Ask {brand.name}
        </button>
      </form>
      <div className="flex items-center gap-2.5">
        <ShipTo variant="chip" />
        <Link href="/inbox" aria-label="Inbox" className="glass relative grid size-11 place-items-center rounded-full">
          <Icon name="chat" className="size-5" />
          <InboxBadge />
        </Link>
        <Link href="/me" className="glass grid size-11 place-items-center rounded-full" aria-label="Your account">
          <Icon name="user" className="size-5" />
        </Link>
        <Link href="/checkout" data-bag aria-label={`Bag, ${cartCount} items`} className="glass glass-prominent grid size-11 place-items-center rounded-full">
          <Icon name="bag" className="size-5" />
          {cartCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-white px-1.5 text-[11px] font-bold text-black">
              {cartCount}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}

