import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { services } from "@/server/container";

/** /unbox opens the newest blind-box series. */
export default function UnboxIndex() {
  return (
    <Suspense fallback={<div className="skeleton pt-safe mx-3.5 mt-16 h-[520px] rounded-[32px] lg:mx-auto lg:max-w-[760px]" />}>
      <Newest />
    </Suspense>
  );
}

async function Newest() {
  await connection();
  const [series] = await (await services()).blindBoxes.series();
  if (series) redirect(`/unbox/${series.id}`);
  return (
    <main className="grid min-h-dvh place-items-center pt-safe pb-safe">
      <EmptyState icon="cube" title="No blind boxes right now" body="When a shop opens a new series, its box machine shows up here." primary={{ href: "/drops", label: "See drops" }} />
    </main>
  );
}
