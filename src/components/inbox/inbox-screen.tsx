"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Icon, VerifiedBadge, type IconName } from "@/components/icon";
import type { NotificationView } from "@/modules/notifications";

export type ChatRow = { href: string; name: string; avatar: string | null; verified: boolean; preview: string; at: string; unread: boolean };

/** Notification kinds as the inbox shows them. */
const ICON: Record<string, IconName> = {
  message: "comment",
  answer: "comment",
  question: "comment",
  order_paid: "truck",
  order_shipped: "truck",
  funds_released: "card",
  refund_approved: "card",
  refund_sent: "card",
  payout_sent: "card",
  commission: "gift",
  chop_done: "scissors",
  team_full: "users",
  reminder: "bell",
  auction_won: "gavel",
  video_live: "play",
  sample: "gift",
  review: "star",
};

const when = (iso: string) => {
  const d = new Date(iso);
  const mins = Math.round((Date.now() - d.getTime()) / 60_000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  if (mins < 24 * 60) return `${Math.round(mins / 60)}h`;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
};
const isToday = (iso: string) => new Date(iso).toDateString() === new Date().toDateString();

/** Chats with shops and everything that happened while you were away. */
export function InboxScreen({ signedIn, chats, activity, title = "Inbox", back }: { signedIn: boolean; chats: ChatRow[]; activity: NotificationView[]; title?: string; back?: string }) {
  const [tab, setTab] = useState<"chats" | "activity">("chats");
  const unreadChats = chats.filter((c) => c.unread).length;
  const unreadActivity = activity.filter((a) => !a.read).length;

  return (
    <div className="mx-auto max-w-[760px] px-3.5 pt-safe pb-36 lg:px-6 lg:pt-6 lg:pb-16">
      <header className="flex items-center gap-3 pt-2 pb-4 lg:pt-0">
        {back && (
          <Link href={back} aria-label="Back" className="glass grid size-11 shrink-0 place-items-center rounded-full">
            <Icon name="back" className="size-5" />
          </Link>
        )}
        <h1 className="flex-1 font-display text-[34px] font-extrabold tracking-[-0.03em]">{title}</h1>
      </header>

      {!signedIn ? (
        <div className="glass flex flex-col items-center gap-3 rounded-[26px] p-6 text-center">
          <Icon name="chat" className="size-8 text-ink-2" />
          <p className="text-sm text-ink-2">Sign in to message shops and see your order updates.</p>
          <Link href="/signin?next=/inbox" className="flex h-11 items-center rounded-full bg-white px-5 text-sm font-bold text-black">
            Sign in
          </Link>
        </div>
      ) : (
        <>
          {activity.length > 0 && (
            <div role="tablist" aria-label={title} className="glass-inset mb-4 grid grid-cols-2 rounded-full p-1">
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
          )}

          {tab === "chats" ? (
            chats.length ? (
              <ul className="glass flex flex-col divide-y divide-line overflow-hidden rounded-[24px]">
                {chats.map((t) => (
                  <li key={t.href}>
                    <Link href={t.href} className="flex items-center gap-3 px-3.5 py-3 hover:bg-white/5">
                      {t.avatar ? (
                        <Image src={t.avatar} alt="" width={52} height={52} sizes="52px" className="size-[52px] shrink-0 rounded-full object-cover" />
                      ) : (
                        <span className="grid size-[52px] shrink-0 place-items-center rounded-full bg-white/15 text-lg font-bold">{t.name[0]?.toUpperCase()}</span>
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <b className="truncate text-[15px] font-semibold">{t.name}</b>
                          {t.verified && <VerifiedBadge className="size-3.5" />}
                          <span className="ml-auto shrink-0 text-xs text-ink-3">{when(t.at)}</span>
                        </span>
                        <span className="mt-0.5 flex items-center gap-1.5">
                          <span className={`truncate text-[13px] ${t.unread ? "font-semibold text-ink" : "text-ink-2"}`}>{t.preview}</span>
                          {t.unread && <span className="ml-auto size-2.5 shrink-0 rounded-full bg-accent" aria-label="New" />}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="glass-inset rounded-[22px] p-5 text-center text-sm text-ink-2">No chats yet. Message a shop from its page or any listing.</p>
            )
          ) : (
            <div className="flex flex-col gap-5">
              {(["Today", "Earlier"] as const).map((group) => {
                const items = activity.filter((a) => isToday(a.at) === (group === "Today"));
                if (!items.length) return null;
                return (
                  <section key={group} aria-label={group}>
                    <h2 className="mb-2 px-1 text-[11px] font-bold tracking-[0.08em] text-ink-3">{group.toUpperCase()}</h2>
                    <ul className="glass flex flex-col divide-y divide-line overflow-hidden rounded-[24px]">
                      {items.map((a) => (
                        <li key={a.id}>
                          <Link href={a.link ?? "/notifications"} className="flex items-center gap-3 px-3.5 py-3 hover:bg-white/5">
                            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-white/[0.08]">
                              <Icon name={ICON[a.kind] ?? "bell"} className="size-5" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-baseline gap-2">
                                <b className={`truncate text-sm ${a.read ? "font-semibold" : "font-bold"}`}>{a.title}</b>
                                <span className="ml-auto shrink-0 text-xs text-ink-3">{when(a.at)}</span>
                              </span>
                              <span className="line-clamp-2 text-[13px] leading-snug text-ink-2">{a.body}</span>
                            </span>
                            {!a.read && <span className="size-2 shrink-0 rounded-full bg-accent" aria-label="New" />}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
