import type { Metadata } from "next";
import { Suspense } from "react";
import { ConfirmButton } from "@/components/admin/admin-actions";
import { AdminEmpty, AdminFrame, Pill, usd } from "@/components/admin/admin-frame";
import { SellSkeleton } from "@/components/sell/sell-frame";
import { pauseCampaignAction } from "@/server/actions/admin";
import { adminContext } from "@/server/admin/page";
import { campaignList } from "@/server/admin/queries";

export const metadata: Metadata = { title: "Admin · Ads", robots: { index: false } };

export default function AdsAdminPage() {
  return (
    <Suspense fallback={<SellSkeleton />}>
      <Ads />
    </Suspense>
  );
}

async function Ads() {
  const { app } = await adminContext();
  const list = await campaignList(app.db, new Date());
  return (
    <AdminFrame title="Ads" subtitle="Sponsored listings and videos, with the last 7 days of spend.">
      {!list.length ? (
        <AdminEmpty>No campaigns yet.</AdminEmpty>
      ) : (
        <ul className="glass flex flex-col divide-y divide-line overflow-hidden rounded-[24px]">
          {list.map((c) => (
            <li key={c.id} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{c.name}</p>
                <p className="truncate text-xs text-ink-2">
                  {c.sellerId} · {c.items} items · {usd(c.bid)} a tap · {usd(c.dailyBudget)} a day
                </p>
                <p className="truncate text-xs text-ink-2">
                  7 days: {c.impressions7d.toLocaleString()} shown · {c.clicks7d.toLocaleString()} taps · {usd(c.spend7d)} spent
                </p>
              </div>
              <Pill tone={c.status === "active" ? "good" : "plain"}>{c.status}</Pill>
              {c.status === "active" && <ConfirmButton label="Pause" tone="danger" action={pauseCampaignAction.bind(null, c.id)} />}
            </li>
          ))}
        </ul>
      )}
    </AdminFrame>
  );
}
