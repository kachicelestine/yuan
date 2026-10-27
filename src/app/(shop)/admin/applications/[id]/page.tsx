import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ApplicationReview } from "@/components/admin/application-review";
import { SellFrame, SellSkeleton } from "@/components/sell/sell-frame";
import { services } from "@/server/container";
import { currentAdmin } from "@/server/session";

export const metadata: Metadata = { title: "Review application", robots: { index: false } };

// Ids are private and per person, so nothing is prerendered; one placeholder lets the
// shared shell build (the body below is always rendered per request).
export function generateStaticParams() {
  return [{ id: "00000000-0000-0000-0000-000000000000" }];
}

export default function ApplicationPage({ params }: PageProps<"/admin/applications/[id]">) {
  return (
    <Suspense fallback={<SellSkeleton />}>
      <ApplicationBody params={params} />
    </Suspense>
  );
}

async function ApplicationBody({ params }: { params: PageProps<"/admin/applications/[id]">["params"] }) {
  await connection();
  if (!(await currentAdmin())) notFound();
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) notFound();
  const application = await (await services()).onboarding.review(id);
  if (!application) notFound();
  return (
    <SellFrame title="Review application" back="/admin/queues">
      <ApplicationReview application={application} />
    </SellFrame>
  );
}
