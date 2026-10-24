import type { Metadata } from "next";
import { InboxScreen, type ThreadRow } from "@/components/inbox/inbox-screen";
import { getSeller } from "@/lib/catalog";
import { activity, threads } from "@/lib/inbox";

export const metadata: Metadata = { title: "Inbox" };

export default function InboxPage() {
  const rows: ThreadRow[] = threads.flatMap((t) => {
    const seller = getSeller(t.sellerId);
    const last = t.messages.at(-1);
    if (!seller || !last) return [];
    return [{ sellerId: seller.id, name: seller.name, avatar: seller.avatar, verified: seller.verified, preview: `${last.from === "me" ? "You: " : ""}${last.text}`, at: last.at, unread: t.unread, translated: !!last.original }];
  });
  return <InboxScreen threads={rows} activity={activity} />;
}
