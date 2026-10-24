"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/icon";
import { useStore } from "@/components/providers";
import { useChrome } from "./chrome";

const tabs: { href: string; label: string; icon: IconName }[] = [
  { href: "/", label: "Home", icon: "home" },
  { href: "/discover", label: "Discover", icon: "compass" },
  { href: "/live", label: "Live", icon: "live" },
  { href: "/drops", label: "Drops", icon: "bolt" },
  { href: "/me", label: "Me", icon: "user" },
];

export function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/** Mobile tab bar: a floating Liquid Glass capsule plus a separate, prominent bag button (iOS 27 tab roles). */
export function TabBar() {
  const pathname = usePathname();
  const { cartCount } = useStore();
  const { navExpanded, setNavExpanded } = useChrome();

  // Live rooms, chats and gift unwrapping are immersive and carry their own bottom controls.
  if (pathname.startsWith("/live/") || pathname === "/ask" || pathname === "/gift" || /^\/inbox\/./.test(pathname)) return null;

  // On the feed the bar rests minimized to the current tab, leaving the middle of the row
  // to the product accessory (iOS 26/27 tab bar minimize + bottom accessory).
  const onFeed = pathname === "/";
  const minimized = onFeed && !navExpanded;

  return (
    <nav aria-label="Main" className="bottom-safe pointer-events-none fixed inset-x-3 z-40 flex items-center justify-between gap-2.5 lg:hidden">
      {minimized ? (
        <button
          type="button"
          onClick={() => setNavExpanded(true)}
          aria-label="Home. Show all tabs"
          className="glass glass-bar pointer-events-auto grid size-12 place-items-center rounded-full motion-safe:animate-pop"
        >
          <Icon name="home" />
        </button>
      ) : (
        <div className={`glass glass-bar pointer-events-auto flex h-16 flex-1 items-center rounded-full px-1 ${onFeed ? "motion-safe:animate-unfurl" : ""}`}>
          {tabs.map((tab) => {
            const active = isActive(pathname, tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                onClick={() => setNavExpanded(false)}
                aria-current={active ? "page" : undefined}
                className={`relative flex h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-full text-[10px] font-semibold tracking-wide transition-colors ${active ? "glass-selected text-ink" : "text-ink-2 hover:text-ink"}`}
              >
                <Icon name={tab.icon} className="size-6" />
                {tab.label}
              </Link>
            );
          })}
        </div>
      )}
      <Link
        href="/checkout"
        data-bag
        aria-label={`Bag, ${cartCount} ${cartCount === 1 ? "item" : "items"}`}
        className={`glass glass-prominent pointer-events-auto grid shrink-0 place-items-center rounded-full transition-[width,height] duration-500 ease-spring ${minimized ? "size-12" : "size-16"}`}
      >
        <Icon name="bag" />
        {cartCount > 0 && (
          <span
            className={`absolute grid h-[18px] min-w-[18px] place-items-center rounded-full bg-white px-1.5 text-[11px] font-bold text-black ${minimized ? "-top-0.5 -right-0.5" : "top-2.5 right-2.5"}`}
          >
            {cartCount}
          </span>
        )}
      </Link>
    </nav>
  );
}

