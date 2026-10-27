import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminEmpty, AdminFrame } from "@/components/admin/admin-frame";
import { SellSkeleton } from "@/components/sell/sell-frame";
import { auditLog } from "@/server/admin/audit";
import { adminContext } from "@/server/admin/page";

export const metadata: Metadata = { title: "Admin · Audit", robots: { index: false } };

export default function AuditPage() {
  return (
    <Suspense fallback={<SellSkeleton />}>
      <Audit />
    </Suspense>
  );
}

async function Audit() {
  const { app } = await adminContext();
  const list = await auditLog(app.db, { limit: 200 });
  return (
    <AdminFrame title="Audit" subtitle="Every admin decision: who, what, and why. Nothing here can be edited.">
      {!list.length ? (
        <AdminEmpty>No decisions yet.</AdminEmpty>
      ) : (
        <ol className="glass flex flex-col divide-y divide-line overflow-hidden rounded-[24px]">
          {list.map((e) => (
            <li key={e.id} className="flex flex-col gap-0.5 px-4 py-3">
              <p className="flex items-center justify-between gap-2 text-sm">
                <span className="truncate font-semibold">
                  {e.action} <span className="font-normal text-ink-2">{e.targetType} {e.targetId}</span>
                </span>
                <time dateTime={e.at} className="shrink-0 text-[11px] text-ink-3">
                  {new Date(e.at).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </time>
              </p>
              <p className="truncate text-xs text-ink-2">
                {e.adminEmail ?? e.adminId}
                {e.note && <> · “{e.note}”</>}
              </p>
            </li>
          ))}
        </ol>
      )}
    </AdminFrame>
  );
}
