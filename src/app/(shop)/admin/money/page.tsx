import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AdminEmpty, AdminFrame, usd } from "@/components/admin/admin-frame";
import { SellSkeleton } from "@/components/sell/sell-frame";
import { adminContext } from "@/server/admin/page";
import { ledgerSummary } from "@/server/admin/queries";

export const metadata: Metadata = { title: "Admin · Money", robots: { index: false } };

export default function MoneyPage() {
  return (
    <Suspense fallback={<SellSkeleton />}>
      <Money />
    </Suspense>
  );
}

async function Money() {
  const { app } = await adminContext();
  const [lines, pending] = await Promise.all([ledgerSummary(app.db), app.escrow.pending()]);
  const owed = pending.reduce((n, d) => n + d.amount, 0);
  return (
    <AdminFrame title="Money" subtitle="Balances straight from the ledger. Every journal sums to zero.">
      <Link href="/admin/queues" className={`mb-4 flex items-center justify-between gap-3 rounded-[24px] p-4 ${pending.length ? "bg-accent/20 ring-1 ring-accent/40" : "glass"}`}>
        <span>
          <span className="block text-sm font-bold">{pending.length ? `${pending.length} transfers to send · ${usd(owed)}` : "No transfers waiting"}</span>
          <span className="block text-xs text-ink-2">Payouts to shops and creators, and refunds to buyers, go out from the treasury wallet.</span>
        </span>
        <span className="shrink-0 text-sm font-semibold text-agent">Send</span>
      </Link>
      {!lines.length ? (
        <AdminEmpty>No money has moved yet.</AdminEmpty>
      ) : (
        <ul className="glass flex flex-col divide-y divide-line overflow-hidden rounded-[24px]">
          {lines.map((l) => (
            <li key={l.account} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold">{l.label}</span>
                <span className="block truncate font-mono text-[11px] text-ink-3">{l.account}</span>
              </span>
              <span className={`shrink-0 text-sm font-bold tabular-nums ${l.balance < 0 ? "text-ink" : "text-ink-2"}`}>{usd(Math.abs(l.balance))}</span>
            </li>
          ))}
        </ul>
      )}
    </AdminFrame>
  );
}
