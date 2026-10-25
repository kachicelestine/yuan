import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { EmptyState } from "@/components/empty-state";
import { Icon } from "@/components/icon";
import { services } from "@/server/container";

export const metadata: Metadata = { title: "Blind boxes", description: "Pick a sealed box from a real case, with the odds published." };

/** Every live blind-box series (straight to the machine when there's only one). */
export default function UnboxIndex() {
  return (
    <Suspense fallback={<div className="skeleton pt-safe mx-3.5 mt-16 h-[520px] rounded-[32px] lg:mx-auto lg:max-w-[760px]" />}>
      <AllSeries />
    </Suspense>
  );
}

async function AllSeries() {
  await connection();
  const series = await (await services()).blindBoxes.series();
  if (series.length === 1) redirect(`/unbox/${series[0].id}`);
  if (!series.length) {
    return (
      <main className="grid min-h-dvh place-items-center pt-safe pb-safe">
        <EmptyState icon="cube" title="No blind boxes right now" body="When a shop opens a new series, its box machine shows up here." primary={{ href: "/drops", label: "See drops" }} />
      </main>
    );
  }
  return (
    <div className="mx-auto max-w-[760px] px-3.5 pt-safe pb-36 lg:pt-6 lg:pb-16">
      <header className="flex items-center gap-3 pt-2 pb-4 lg:pt-0">
        <Link href="/drops" aria-label="Back to drops" className="glass grid size-11 shrink-0 place-items-center rounded-full">
          <Icon name="back" className="size-5" />
        </Link>
        <h1 className="font-display text-[28px] font-extrabold tracking-[-0.03em]">Blind boxes</h1>
      </header>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {series.map((s) => (
          <li key={s.id}>
            <Link href={`/unbox/${s.id}`} className="glass block overflow-hidden rounded-[24px]">
              <span className="relative block aspect-square">{s.poster && <Image src={s.poster} alt="" fill sizes="(min-width: 640px) 240px, 50vw" className="object-cover" />}</span>
              <span className="block p-3">
                <b className="block truncate text-[15px] font-semibold">{s.title}</b>
                <span className="text-xs text-ink-2">
                  {s.figures.filter((f) => !f.secret).length} figures{s.figures.some((f) => f.secret) ? " + a secret" : ""}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
