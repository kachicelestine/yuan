"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/icon";
import { REASON_LABELS, type ModerationItemView, type PendingVideoView } from "@/modules/content";
import type { ApplicationView } from "@/modules/merchants";
import { approveVideoAction, resolveAction } from "@/server/actions/admin";

type Tab = "sellers" | "videos" | "reports";

/** Three queues: seller applications, uploads waiting for approval, and reports. */
export function AdminConsole({ applications, videos, reports }: { applications: ApplicationView[]; videos: PendingVideoView[]; reports: ModerationItemView[] }) {
  const [tab, setTab] = useState<Tab>(applications.length ? "sellers" : videos.length ? "videos" : "reports");
  const tabs: { id: Tab; label: string; count: number }[] = [
    { id: "sellers", label: "Sellers", count: applications.length },
    { id: "videos", label: "Videos", count: videos.length },
    { id: "reports", label: "Reports", count: reports.length },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div role="tablist" aria-label="Queues" className="glass grid grid-cols-3 rounded-full p-1">
        {tabs.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tab === t.id} onClick={() => setTab(t.id)} className={`h-9 rounded-full text-[13px] font-semibold ${tab === t.id ? "bg-white/15 text-ink" : "text-ink-2"}`}>
            {t.label}
            {t.count > 0 && <span className="ml-1 rounded-full bg-accent px-1.5 text-[10px] font-bold text-white">{t.count}</span>}
          </button>
        ))}
      </div>
      {tab === "sellers" && <Applications list={applications} />}
      {tab === "videos" && <PendingVideos list={videos} />}
      {tab === "reports" && <Reports list={reports} />}
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="glass-inset rounded-[22px] p-4 text-sm text-ink-2">{children}</p>;
}

function Applications({ list }: { list: ApplicationView[] }) {
  if (!list.length) return <Empty>No applications waiting.</Empty>;
  return (
    <ul className="glass flex flex-col divide-y divide-line overflow-hidden rounded-[24px]">
      {list.map((a) => (
        <li key={a.id}>
          <Link href={`/admin/applications/${a.id}`} className="flex items-center gap-3 px-4 py-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-white/10">
              <Icon name="store" className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{a.business?.name ?? "Unnamed"}</span>
              <span className="block text-xs text-ink-2">
                {a.business?.kind} · {a.business?.city}, {a.business?.country} · {a.documents.length} documents
                {a.submittedAt && <> · {new Date(a.submittedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</>}
              </span>
            </span>
            <Icon name="forward" className="size-4 text-ink-3" />
          </Link>
        </li>
      ))}
    </ul>
  );
}

function PendingVideos({ list }: { list: PendingVideoView[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(id: string, approve: boolean) {
    setBusy(id);
    setError(null);
    const r = approve ? await approveVideoAction(id) : await resolveAction("video", id, "remove");
    setBusy(null);
    if (!r.ok) return setError(r.message);
    router.refresh();
  }

  if (!list.length) return <Empty>No uploads waiting for review.</Empty>;
  return (
    <div className="flex flex-col gap-2">
      {error && (
        <p role="alert" className="text-sm text-like">
          {error}
        </p>
      )}
      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {list.map((v) => (
          <li key={v.id} className="glass overflow-hidden rounded-[22px]">
            <div className="relative aspect-[9/16] bg-surface">
              {v.clip ? (
                <video src={v.clip} poster={v.image || undefined} className="absolute inset-0 size-full object-cover" controls playsInline preload="metadata" />
              ) : (
                v.image && <Image src={v.image} alt="" fill sizes="200px" className="object-cover" />
              )}
            </div>
            <div className="flex flex-col gap-2 p-2.5">
              <p className="line-clamp-2 text-xs">{v.caption}</p>
              <Link href={`/p/${v.productSlug}`} className="truncate text-[11px] text-agent">
                {v.productSlug} · {v.sellerId}
              </Link>
              <div className="flex gap-1.5">
                <button type="button" disabled={busy === v.id} onClick={() => decide(v.id, true)} className="h-9 flex-1 rounded-full bg-positive/20 text-xs font-bold text-positive disabled:opacity-50">
                  Approve
                </button>
                <button type="button" disabled={busy === v.id} onClick={() => decide(v.id, false)} className="h-9 flex-1 rounded-full bg-like/15 text-xs font-bold text-like disabled:opacity-50">
                  Remove
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Reports({ list }: { list: ModerationItemView[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function decide(item: ModerationItemView, action: "remove" | "dismiss") {
    setBusy(item.targetId);
    setError(null);
    const r = await resolveAction(item.targetType, item.targetId, action);
    setBusy(null);
    if (!r.ok) return setError(r.message);
    router.refresh();
  }

  if (!list.length) return <Empty>Nothing reported.</Empty>;
  return (
    <ul className="flex flex-col gap-2">
      {error && (
        <li role="alert" className="text-sm text-like">
          {error}
        </li>
      )}
      {list.map((item) => (
        <li key={`${item.targetType}:${item.targetId}`} className="glass flex gap-3 rounded-[22px] p-3.5">
          {item.preview.image && <Image src={item.preview.image} alt="" width={64} height={64} sizes="64px" className="size-16 shrink-0 rounded-xl object-cover" />}
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <p className="flex items-center justify-between gap-2 text-xs text-ink-2">
              <span className="truncate font-semibold text-ink">{item.preview.title}</span>
              <span className="shrink-0 rounded-full bg-like/15 px-2 py-0.5 font-bold text-like">{item.count} reports</span>
            </p>
            <p className="line-clamp-3 text-sm whitespace-pre-line">{item.preview.text}</p>
            <p className="text-xs text-ink-2">{item.reasons.map((r) => REASON_LABELS[r]).join(" · ")}</p>
            {item.notes.length > 0 && <p className="text-xs text-ink-3 italic">“{item.notes.slice(0, 2).join("” “")}”</p>}
            <div className="mt-1 flex flex-wrap gap-1.5">
              {item.preview.link && (
                <Link href={item.preview.link} target="_blank" className="glass-inset h-8 rounded-full px-3 text-xs leading-8 font-semibold">
                  Open
                </Link>
              )}
              <button type="button" disabled={busy === item.targetId} onClick={() => decide(item, "remove")} className="h-8 rounded-full bg-like/15 px-3 text-xs font-bold text-like disabled:opacity-50">
                Remove
              </button>
              <button type="button" disabled={busy === item.targetId} onClick={() => decide(item, "dismiss")} className="h-8 rounded-full bg-white/10 px-3 text-xs font-bold text-ink-2 disabled:opacity-50">
                Keep it
              </button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
