import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { ConfirmButton } from "@/components/admin/admin-actions";
import { AdminEmpty, AdminFrame, AdminSearch, day, Pill } from "@/components/admin/admin-frame";
import { SellSkeleton } from "@/components/sell/sell-frame";
import { approveVideoAction, endShowAction, resolveAction } from "@/server/actions/admin";
import { adminContext, param } from "@/server/admin/page";
import { showList, videoList } from "@/server/admin/queries";

export const metadata: Metadata = { title: "Admin · Content", robots: { index: false } };

const VIDEO_TONE = { ready: "good", review: "warn", processing: "plain", failed: "bad", removed: "bad" } as const;

export default function ContentPage({ searchParams }: PageProps<"/admin/content">) {
  return (
    <Suspense fallback={<SellSkeleton />}>
      <Content searchParams={searchParams} />
    </Suspense>
  );
}

async function Content({ searchParams }: { searchParams: PageProps<"/admin/content">["searchParams"] }) {
  const { app } = await adminContext();
  const q = param((await searchParams).q);
  const [videos, shows] = await Promise.all([videoList(app.db, q), q ? Promise.resolve([]) : showList(app.db)]);
  return (
    <AdminFrame title="Content" subtitle="Live shows and every video and post, newest first.">
      {shows.length > 0 && (
        <section aria-labelledby="shows-h" className="mb-5">
          <h2 id="shows-h" className="mb-2 px-1 text-[11px] font-bold tracking-[0.08em] text-ink-3">
            LIVE SHOWS
          </h2>
          <ul className="glass flex flex-col divide-y divide-line overflow-hidden rounded-[24px]">
            {shows.slice(0, 12).map((s) => (
              <li key={s.id} className="flex items-center gap-3 px-4 py-3">
                {s.cover && <Image src={s.cover} alt="" width={44} height={44} sizes="44px" className="size-11 shrink-0 rounded-xl object-cover" />}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{s.title}</p>
                  <p className="truncate text-xs text-ink-2">
                    {s.sellerId} · {s.hostName} · {s.status === "live" ? `${s.peakViewers} peak viewers` : day(s.scheduledFor)}
                  </p>
                </div>
                <Pill tone={s.status === "live" ? "bad" : "plain"}>{s.status}</Pill>
                {s.status === "live" && <ConfirmButton label="End show" tone="danger" action={endShowAction.bind(null, s.id)} />}
              </li>
            ))}
          </ul>
        </section>
      )}

      <h2 className="mb-2 px-1 text-[11px] font-bold tracking-[0.08em] text-ink-3">VIDEOS</h2>
      <AdminSearch action="/admin/content" q={q} placeholder="Caption, shop id or product" />
      {!videos.length ? (
        <AdminEmpty>No video matches.</AdminEmpty>
      ) : (
        <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {videos.map((v) => (
            <li key={v.id} className="glass flex flex-col overflow-hidden rounded-[22px]">
              <div className="relative aspect-[4/5] bg-surface">
                {v.poster && <Image src={v.poster} alt="" fill sizes="(min-width: 640px) 260px, 45vw" className="object-cover" />}
                <span className="absolute top-2 left-2">
                  <Pill tone={VIDEO_TONE[v.status as keyof typeof VIDEO_TONE] ?? "plain"}>{v.status}</Pill>
                </span>
              </div>
              <div className="flex flex-1 flex-col gap-1.5 p-2.5">
                <p className="line-clamp-2 text-xs">{v.caption}</p>
                <Link href={`/p/${v.productSlug}`} target="_blank" className="truncate text-[11px] text-agent">
                  {v.sellerId} · {v.views.toLocaleString()} views · {v.likes.toLocaleString()} likes
                </Link>
                <div className="mt-auto flex flex-wrap gap-1.5">
                  {v.status === "review" && <ConfirmButton label="Approve" tone="good" action={approveVideoAction.bind(null, v.id)} />}
                  {v.status !== "removed" && <ConfirmButton label="Remove" tone="danger" action={resolveAction.bind(null, "video", v.id, "remove")} />}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </AdminFrame>
  );
}
