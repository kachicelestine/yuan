"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const ADMIN_SECTIONS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/queues", label: "Queues" },
  { href: "/admin/users", label: "People" },
  { href: "/admin/shops", label: "Shops" },
  { href: "/admin/listings", label: "Listings" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/content", label: "Content" },
  { href: "/admin/coupons", label: "Coupons" },
  { href: "/admin/ads", label: "Ads" },
  { href: "/admin/money", label: "Money" },
  { href: "/admin/audit", label: "Audit" },
] as const;

/** Sections of the admin panel, one row that scrolls sideways on a phone. */
export function AdminNav() {
  const path = usePathname();
  return (
    <nav aria-label="Admin sections" className="-mx-3.5 mb-4 overflow-x-auto px-3.5 [scrollbar-width:none] lg:mx-0 lg:px-0">
      <ul className="flex w-max gap-1.5">
        {ADMIN_SECTIONS.map((s) => {
          const on = s.href === "/admin" ? path === "/admin" : path.startsWith(s.href);
          return (
            <li key={s.href}>
              <Link href={s.href} aria-current={on ? "page" : undefined} className={`block h-9 rounded-full px-3.5 text-[13px] leading-9 font-semibold ${on ? "bg-white/15 text-ink" : "glass-inset text-ink-2"}`}>
                {s.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
