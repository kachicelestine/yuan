import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AdminConsole } from "@/components/admin/admin-console";
import { SellFrame, SellSkeleton } from "@/components/sell/sell-frame";
import { serverEnv } from "@/config/server-env";
import { services } from "@/server/container";
import { currentAdmin } from "@/server/session";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

export default function AdminPage() {
  return (
    <Suspense fallback={<SellSkeleton />}>
      <AdminBody />
    </Suspense>
  );
}

async function AdminBody() {
  await connection();
  // Not an admin: the page doesn't exist, rather than saying it's forbidden.
  if (!(await currentAdmin())) notFound();
  const app = await services();
  const [applications, videos, reports, disputes, transfers] = await Promise.all([
    app.onboarding.queue(),
    app.moderation.pendingVideos(),
    app.moderation.queue(),
    app.fulfilment.disputes(),
    app.escrow.pending(),
  ]);
  const explorer = serverEnv.PAYMENTS_BASE_CHAIN === "base" ? "https://basescan.org" : "https://sepolia.basescan.org";
  return (
    <SellFrame title="Admin" subtitle="Sellers, uploads, reports, disputes and money to send, oldest first.">
      <AdminConsole applications={applications} videos={videos} reports={reports} disputes={disputes} transfers={transfers} explorer={explorer} />
    </SellFrame>
  );
}
