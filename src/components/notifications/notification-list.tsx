"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Icon, type IconName } from "@/components/icon";
import type { NotificationView } from "@/modules/notifications";
import { markNotificationsReadAction } from "@/server/actions/orders";

const ICONS: Record<string, IconName> = {
  order_paid: "bag",
  order_shipped: "truck",
  funds_released: "card",
  refund_approved: "returns",
  refund_sent: "returns",
  dispute_opened: "flag",
  payout_sent: "card",
  question: "chat",
  answer: "chat",
  review: "star",
  application: "store",
  video_live: "play",
};

/** When it happened, briefly. */
function when(iso: string) {
  const minutes = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** Everything that happened to your orders, shop and posts, newest first. Opening the list marks it read. */
export function NotificationList({ items }: { items: NotificationView[] }) {
  const unread = items.some((n) => !n.read);
  useEffect(() => {
    if (unread) void markNotificationsReadAction();
  }, [unread]);

  if (!items.length) {
    return (
      <p className="glass-inset flex items-center gap-3 rounded-[22px] p-4 text-sm text-ink-2">
        <Icon name="bell" className="size-5" />
        Nothing yet. Orders, replies and payouts show up here.
      </p>
    );
  }
  return (
    <ul className="glass flex flex-col divide-y divide-line overflow-hidden rounded-[24px]">
      {items.map((n) => {
        const body = (
          <>
            <span className={`grid size-10 shrink-0 place-items-center rounded-full ${n.read ? "bg-white/[0.07] text-ink-2" : "bg-accent/20 text-accent-light"}`}>
              <Icon name={ICONS[n.kind] ?? "bell"} className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-baseline justify-between gap-2">
                <span className={`truncate text-sm ${n.read ? "font-medium" : "font-bold"}`}>{n.title}</span>
                <span className="shrink-0 text-xs text-ink-3">{when(n.at)}</span>
              </span>
              <span className="line-clamp-2 text-[13px] text-ink-2">{n.body}</span>
            </span>
          </>
        );
        return (
          <li key={n.id}>
            {n.link ? (
              <Link href={n.link} className="flex items-start gap-3 px-4 py-3">
                {body}
              </Link>
            ) : (
              <div className="flex items-start gap-3 px-4 py-3">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
