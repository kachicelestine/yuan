import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { InboxScreen } from "@/components/inbox/inbox-screen";
import { SellSkeleton } from "@/components/sell/sell-frame";
import { services } from "@/server/container";
import { currentShop } from "@/server/shop";

export const metadata: Metadata = { title: "Messages", robots: { index: false } };

export default function SellInboxPage() {
  return (
    <Suspense fallback={<SellSkeleton />}>
      <Body />
    </Suspense>
  );
}

async function Body() {
  await connection();
  const shop = await currentShop();
  if (!shop) redirect("/sell");
  const conversations = await (await services()).messaging.shopInbox(shop.sellerId);
  const chats = conversations.map((c) => ({ href: `/sell/inbox/${c.id}`, name: c.buyerName, avatar: null, verified: false, preview: `${c.lastFrom === "shop" ? "You: " : ""}${c.lastText}`, at: c.lastAt, unread: c.unread }));
  return <InboxScreen signedIn title="Messages" back="/sell" chats={chats} activity={[]} />;
}
