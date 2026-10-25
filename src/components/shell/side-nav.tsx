"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/icon";
import { isActive } from "@/components/shell/tab-bar";
import { brand } from "@/config/brand";
import { useEffect, useState } from "react";
import { useStored } from "@/lib/use-stored";

const links: { href: string; label: string; icon: IconName; live?: boolean }[] = [
  { href: "/", label: "For You", icon: "home" },
  { href: "/discover", label: "Discover", icon: "compass" },
  { href: "/c", label: "Categories", icon: "store" },
  { href: "/live", label: "Live", icon: "live" },
  { href: "/drops", label: "Drops", icon: "bolt" },
  { href: "/me", label: "Me", icon: "user" },
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
          </Link>
        );
      })}

      <FollowingShops />

      <p className="mt-6 px-4 text-xs leading-relaxed text-ink-3">
        Every seller is checked by hand before they can sell. Payments are held by {brand.name} Protect until your order arrives.
      </p>
    </nav>
  );
}

type Shop = { id: string; name: string; avatar: string };

/** Shops this device follows (synced with the account when signed in). */
function FollowingShops() {
  const [following] = useStored<string[]>("app.following", []);
  const key = following.slice(0, 12).join(",");
  const [shops, setShops] = useState<{ key: string; list: Shop[] }>({ key: "", list: [] });

  useEffect(() => {
    if (!key) return;
    let live = true;
    fetch(`/api/shops?ids=${encodeURIComponent(key)}`)
      .then((r) => (r.ok ? (r.json() as Promise<{ shops: Shop[] }>) : { shops: [] }))
      .then(
        (body) => live && setShops({ key, list: key.split(",").flatMap((id) => body.shops.find((s) => s.id === id) ?? []) }),
        () => {},
      );
    return () => {
      live = false;
    };
  }, [key]);

  const list = key && shops.key === key ? shops.list : [];
  if (!list.length) return null;
  return (
    <>
      <h2 className="mt-6 mb-1 px-4 text-xs font-bold tracking-[0.08em] text-ink-3">FOLLOWING</h2>
      {list.map((seller) => (
        <Link key={seller.id} href={`/s/${seller.id}`} className="flex h-12 items-center gap-3 rounded-full px-2.5 text-sm font-semibold hover:bg-white/5">
          <Image src={seller.avatar} alt="" width={32} height={32} className="size-8 rounded-full object-cover" />
          <span className="min-w-0 flex-1 truncate">{seller.name}</span>
        </Link>
      ))}
    </>
  );
}
