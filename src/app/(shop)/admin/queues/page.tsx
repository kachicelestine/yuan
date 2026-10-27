import type { Metadata } from "next";
import { Suspense } from "react";
import { AdminConsole } from "@/components/admin/admin-console";
import { AdminFrame } from "@/components/admin/admin-frame";
import { SellSkeleton } from "@/components/sell/sell-frame";
import { serverEnv } from "@/config/server-env";
import { adminContext } from "@/server/admin/page";

export const metadata: Metadata = { title: "Admin queues", robots: { index: false } };

export default function QueuesPage() {
  return (
    <Suspense fallback={<SellSkeleton />}>
      <Queues />
    </Suspense>
  );
}

async function Queues() {
  const { app } = await adminContext();
  const [applications, videos, reports, disputes, transfers] = await Promise.all([
    app.onboarding.queue(),
    app.moderation.pendingVideos(),
    app.moderation.queue(),
    app.fulfilment.disputes(),
    app.escrow.pending(),
  ]);
  const explorer = serverEnv.PAYMENTS_BASE_CHAIN === "base" ? "https://basescan.org" : "https://sepolia.basescan.org";
  return (
    <AdminFrame title="Queues" subtitle="Sellers, uploads, reports, disputes and money to send, oldest first.">
      <AdminConsole applications={applications} videos={videos} reports={reports} disputes={disputes} transfers={transfers} explorer={explorer} />
    </AdminFrame>
  );
}
