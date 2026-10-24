"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import type { Rfq } from "@/components/ask/ask-screen";
import { Icon, VerifiedBadge, type IconName } from "@/components/icon";
import { getSeller, type Activity } from "@/lib/catalog";
import { useStored } from "@/lib/use-stored";

export type ThreadRow = { sellerId: string; name: string; avatar: string; verified: boolean; preview: string; at: string; unread: number; translated: boolean };

const activityIcon: Record<Activity["kind"], IconName> = { price: "bolt", live: "live", reply: "comment", order: "truck", team: "users", coins: "gift", restock: "bell" };

/** Chats with sellers (auto-translated) and everything that happened while you were away. */
export function InboxScreen({ threads, activity }: { threads: ThreadRow[]; activity: Activity[] }) {
  const [tab, setTab] = useState<"chats" | "activity">("chats");
  const [rfqs] = useStored<Rfq[]>("app.rfqs", []);
  const unreadChats = threads.reduce((n, t) => n + t.unread, 0);
  const unreadActivity = activity.filter((a) => a.unread).length;

  return (
    <div className="mx-auto max-w-[760px] px-3.5 pt-safe pb-36 lg:px-6 lg:pt-6 lg:pb-16">
      <header className="flex items-center gap-3 pt-2 pb-4 lg:pt-0">
        <h1 className="flex-1 font-display text-[34px] font-extrabold tracking-[-0.03em]">Inbox</h1>
        <Link href="/ask" className="glass flex h-10 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold">
          <Icon name="sparkle" className="size-4 text-agent" />
          Ask
        </Link>
      </header>

      <div role="tablist" aria-label="Inbox" className="glass-inset mb-4 grid grid-cols-2 rounded-full p-1">
        {(
          [
            ["chats", "Chats", unreadChats],
            ["activity", "Activity", unreadActivity],
          ] as const
        ).map(([id, label, count]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={`flex h-10 items-center justify-center gap-2 rounded-full text-sm font-semibold transition-colors ${tab === id ? "bg-white/[0.16] text-ink" : "text-ink-2"}`}
          >
            {label}
            {count > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1.5 text-[11px] font-bold">{count}</span>}
          </button>
        ))}
      </div>

      {tab === "chats" ? (
        <div className="flex flex-col gap-3">
          {rfqs.length > 0 && (
            <section aria-label="Quote requests" className="glass rounded-[24px] p-3.5">
              <h2 className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-ink-2">
                <Icon name="factory" className="size-4" />
                Quote requests from your agent
              </h2>
              <ul className="flex flex-col gap-2">
                {rfqs.map((r) => (
                  <li key={r.id} className="glass-inset flex items-center gap-3 rounded-2xl p-3">
                    <span className="flex -space-x-2">
                      {r.sellerIds.map((id) => {
                        const s = getSeller(id);
                        return s ? <Image key={id} src={s.avatar} alt="" width={30} height={30} sizes="30px" className="size-[30px] rounded-full object-cover ring-2 ring-surface" /> : null;
                      })}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {r.qty.toLocaleString("en-US")} × {r.item}
                      </span>
                      <span className="block text-xs text-ink-2">
                        {r.id} · sent {r.sentAt.toLowerCase()} · waiting for {r.sellerIds.length} {r.sellerIds.length === 1 ? "quote" : "quotes"}
                      </span>
                    </span>
                    <span className="size-2 animate-blink rounded-full bg-save" aria-label="Waiting" />
                  </li>
                ))}
              </ul>
            </section>
          )}
          <ul className="glass flex flex-col divide-y divide-line overflow-hidden rounded-[24px]">
            {threads.map((t) => (
              <li key={t.sellerId}>
                <Link href={`/inbox/${t.sellerId}`} className="flex items-center gap-3 px-3.5 py-3 hover:bg-white/5">
                  <span className="relative shrink-0">
                    <Image src={t.avatar} alt="" width={52} height={52} sizes="52px" className="size-[52px] rounded-full object-cover" />
                    <span className="absolute right-0 bottom-0 size-3.5 rounded-full bg-positive ring-2 ring-surface" aria-label="Online" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <b className="truncate text-[15px] font-semibold">{t.name}</b>
                      {t.verified && <VerifiedBadge className="size-3.5" />}
                      <span className="ml-auto shrink-0 text-xs text-ink-3">{t.at}</span>
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5">
                      {t.translated && <Icon name="globe" className="size-3.5 shrink-0 text-agent" aria-label="Translated" />}
                      <span className={`truncate text-[13px] ${t.unread ? "font-semibold text-ink" : "text-ink-2"}`}>{t.preview}</span>
                      {t.unread > 0 && <span className="ml-auto grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-accent px-1.5 text-[11px] font-bold">{t.unread}</span>}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="flex items-center justify-center gap-1.5 px-6 text-center text-xs text-ink-3">
            <Icon name="globe" className="size-3.5" />
            Chats are translated both ways, so every seller reads you in their own language.
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {(["Today", "Earlier"] as const).map((group) => (
            <section key={group} aria-label={group}>
              <h2 className="mb-2 px-1 text-[11px] font-bold tracking-[0.08em] text-ink-3">{group.toUpperCase()}</h2>
              <ul className="glass flex flex-col divide-y divide-line overflow-hidden rounded-[24px]">
                {activity
                  .filter((a) => a.group === group)
                  .map((a) => (
                    <li key={a.id}>
                      <Link href={a.href} className="flex items-center gap-3 px-3.5 py-3 hover:bg-white/5">
                        <span className="relative shrink-0">
                          {a.image ? (
                            <Image src={a.image} alt="" width={48} height={48} sizes="48px" className={`size-12 object-cover ${a.kind === "live" || a.kind === "reply" ? "rounded-full" : "rounded-xl"}`} />
                          ) : (
                            <span className="grid size-12 place-items-center rounded-xl bg-save/15 text-save">
                              <Icon name="gift" />
                            </span>
                          )}
                          <span className={`absolute -right-1 -bottom-1 grid size-6 place-items-center rounded-full ring-2 ring-surface ${a.kind === "live" ? "bg-live" : a.kind === "price" ? "bg-accent" : "bg-raised"}`}>
                            <Icon name={activityIcon[a.kind]} className="size-3.5" />
                          </span>
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline gap-2">
                            <b className={`truncate text-sm ${a.unread ? "font-bold" : "font-semibold"}`}>{a.title}</b>
                            <span className="ml-auto shrink-0 text-xs text-ink-3">{a.at}</span>
                          </span>
                          <span className="line-clamp-2 text-[13px] leading-snug text-ink-2">{a.body}</span>
                        </span>
                        {a.unread && <span className="size-2 shrink-0 rounded-full bg-accent" aria-label="New" />}
                      </Link>
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
