"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/icon";
import { isActive } from "@/components/shell/tab-bar";
import { brand } from "@/config/brand";
import { sellers } from "@/lib/catalog";

const links: { href: string; label: string; icon: IconName; live?: boolean }[] = [
  { href: "/", label: "For You", icon: "home" },
  { href: "/discover", label: "Discover", icon: "compass" },
  { href: "/c", label: "Categories", icon: "store" },
  { href: "/live", label: "Live", icon: "live", live: true },
  { href: "/drops", label: "Drops", icon: "bolt" },
  { href: "/me", label: "Me", icon: "user" },
];

// Sellers shown under "Following" in the rail (fixtures until accounts exist).
const following = [
  { seller: sellers.glowlab, live: true, href: "/live/glowlab" },
  { seller: sellers.sunvolt, live: false, href: "/" },
  { seller: sellers.mei, live: false, href: "/discover" },
  { seller: sellers.hustudio, live: true, href: "/live/auction" },
  { seller: sellers.sztech, live: false, href: "/" },
];

export function SideNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Sections" className="no-scrollbar hidden flex-col gap-0.5 overflow-y-auto px-4 py-5 lg:flex">
      {links.map((link) => {
        const active = isActive(pathname, link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`flex h-12 items-center gap-3 rounded-full px-4 text-[15px] font-semibold transition-colors ${active ? "glass-inset text-ink" : "text-ink-2 hover:bg-white/5 hover:text-ink"}`}
          >
            <Icon name={link.icon} className="size-[22px]" />
            {link.label}
            {link.live && <span className="ml-auto size-2 rounded-full bg-like" aria-label="Rooms live now" />}
          </Link>
        );
      })}

      <h2 className="mt-6 mb-1 px-4 text-xs font-bold tracking-[0.08em] text-ink-3">FOLLOWING</h2>
      {following.map(({ seller, live, href }) => (
        <Link key={seller.id} href={href} className="flex h-12 items-center gap-3 rounded-full px-2.5 text-sm font-semibold hover:bg-white/5">
          <Image
            src={seller.avatar}
            alt=""
            width={32}
            height={32}
            className={`size-8 rounded-full object-cover ${live ? "ring-2 ring-like ring-offset-2 ring-offset-canvas" : ""}`}
          />
          <span className="min-w-0 flex-1 truncate">{seller.name}</span>
          {live && <span className="text-[10px] font-extrabold tracking-[0.08em] text-like">LIVE</span>}
        </Link>
      ))}

      <p className="mt-6 px-4 text-xs leading-relaxed text-ink-3">
        Every seller is verified. Payments are held by {brand.name} Protect until your order arrives.
      </p>
    </nav>
  );
}

