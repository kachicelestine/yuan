import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { InboxScreen } from "@/components/inbox/inbox-screen";
import { getSellers } from "@/server/catalog";
import { services } from "@/server/container";
import { currentAccount } from "@/server/session";

export const metadata: Metadata = { title: "Inbox" };

export default function InboxPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-[760px] px-3.5 pt-20">
          <div className="skeleton h-[320px] rounded-[24px]" />
        </div>
      }
    >
      <InboxBody />
    </Suspense>
  );
}

async function InboxBody() {
  await connection();
  const account = await currentAccount();
  if (!account) return <InboxScreen signedIn={false} chats={[]} activity={[]} />;
  const app = await services();
  const [conversations, activity, sellers] = await Promise.all([app.messaging.buyerInbox(account.id), app.notifications.list(account.id, 50), getSellers()]);
  const byId = new Map(sellers.map((s) => [s.id, s]));
  const chats = conversations.flatMap((c) => {
    const s = byId.get(c.sellerId);
    return s ? [{ href: `/inbox/${s.id}`, name: s.name, avatar: s.avatar, verified: s.verified, preview: `${c.lastFrom === "buyer" ? "You: " : ""}${c.lastText}`, at: c.lastAt, unread: c.unread }] : [];
  });
  return <InboxScreen signedIn chats={chats} activity={activity} />;
}
