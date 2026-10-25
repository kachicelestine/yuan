"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/components/providers";

/** Unread chats and notifications for the signed-in person (zero when signed out). */
export function useUnread() {
  const { account } = useStore();
  const [unread, setUnread] = useState({ chats: 0, notifications: 0 });
  useEffect(() => {
    if (!account) return;
    const controller = new AbortController();
    fetch("/api/me/unread", { signal: controller.signal, cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<{ chats: number; notifications: number }>) : null))
      .then((r) => r && setUnread(r))
      .catch(() => {});
    return () => controller.abort();
  }, [account]);
  return account ? unread : { chats: 0, notifications: 0 };
}

/** The inbox button's badge: unread chats, if any. */
export function InboxBadge() {
  const { chats } = useUnread();
  if (!chats) return null;
  return <span className="absolute -top-0.5 -right-0.5 grid size-[18px] place-items-center rounded-full bg-accent text-[10px] font-bold">{chats > 9 ? "9+" : chats}</span>;
}
