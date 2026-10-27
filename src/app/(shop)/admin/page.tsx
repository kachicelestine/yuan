import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminFrame, usd } from "@/components/admin/admin-frame";
import { SellSkeleton } from "@/components/sell/sell-frame";
import { adminContext } from "@/server/admin/page";
import { overview } from "@/server/admin/queries";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

export default function AdminPage() {
  return (
    <Suspense fallback={<SellSkeleton />}>
      <Overview />
    </Suspense>
  );
}

async function Overview() {
  const { app } = await adminContext();
  const o = await overview(app.db, new Date());
  const waiting = o.waiting.applications + o.waiting.videos + o.waiting.reports + o.waiting.transfers + o.openDisputes;
  const tiles: { label: string; value: string; sub?: string; href: string }[] = [
    { label: "Paid, 30 days", value: usd(o.gmv), sub: `${o.paidOrders.toLocaleString()} orders`, href: "/admin/orders?status=paid" },
    { label: "Held in escrow", value: usd(o.inEscrow), sub: "until parcels arrive", href: "/admin/money" },
    { label: "Commission", value: usd(o.commission), sub: `ads ${usd(o.adRevenue)}`, href: "/admin/money" },
    { label: "People", value: o.accounts.toLocaleString(), sub: `+${o.newAccounts} this week${o.suspendedAccounts ? ` · ${o.suspendedAccounts} suspended` : ""}`, href: "/admin/users" },
    { label: "Shops", value: o.shops.toLocaleString(), sub: o.suspendedShops ? `${o.suspendedShops} suspended` : "all open", href: "/admin/shops" },
    { label: "Live listings", value: o.liveListings.toLocaleString(), sub: o.removedListings ? `${o.removedListings} removed` : undefined, href: "/admin/listings?status=active" },
    { label: "Live now", value: String(o.liveNow), sub: "shows", href: "/admin/content" },
    { label: "Ads running", value: String(o.runningCampaigns), sub: "campaigns", href: "/admin/ads" },
  ];
  const queues = [
    { label: "Seller applications", n: o.waiting.applications },
    { label: "Videos to review", n: o.waiting.videos },
    { label: "Reports", n: o.waiting.reports },
    { label: "Disputes", n: o.openDisputes },
    { label: "Money to send", n: o.waiting.transfers },
  ];
  return (
    <AdminFrame title="Admin" subtitle="Everything on Lychee, in one place.">
      <Link href="/admin/queues" className={`mb-4 flex items-center justify-between gap-3 rounded-[24px] p-4 ${waiting ? "bg-accent/20 ring-1 ring-accent/40" : "glass"}`}>
        <span>
          <span className="block text-sm font-bold">{waiting ? `${waiting} waiting for a decision` : "Nothing waiting"}</span>
          <span className="block text-xs text-ink-2">
            {queues
              .filter((q) => q.n)
              .map((q) => `${q.label} ${q.n}`)
              .join(" · ") || "Applications, uploads, reports, disputes and transfers are all clear."}
          </span>
        </span>
        <span className="shrink-0 text-sm font-semibold text-agent">Open queues</span>
      </Link>
      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {tiles.map((t) => (
          <li key={t.label}>
            <Link href={t.href} className="glass flex h-full flex-col rounded-[22px] p-3.5">
              <span className="text-[11px] font-semibold text-ink-2">{t.label}</span>
              <span className="mt-1 font-display text-[22px] leading-tight font-extrabold tracking-[-0.02em] tabular-nums">{t.value}</span>
              {t.sub && <span className="mt-0.5 text-[11px] text-ink-3">{t.sub}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </AdminFrame>
  );
}
