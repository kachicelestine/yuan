import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { AdminConsole } from "@/components/admin/admin-console";
import { SellFrame, SellSkeleton } from "@/components/sell/sell-frame";
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
  const [applications, videos, reports] = await Promise.all([app.onboarding.queue(), app.moderation.pendingVideos(), app.moderation.queue()]);
  return (
    <SellFrame title="Admin" subtitle="Sellers, uploads and reports, oldest first.">
      <AdminConsole applications={applications} videos={videos} reports={reports} />
    </SellFrame>
  );
}
