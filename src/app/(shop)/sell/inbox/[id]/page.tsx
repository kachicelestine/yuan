import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ChatThread, type ChatProduct } from "@/components/inbox/chat-thread";
import { services } from "@/server/container";
import { currentShop } from "@/server/shop";

export const metadata: Metadata = { title: "Chat with a buyer", robots: { index: false } };

// Conversations are private to their shop, so nothing is prerendered; the placeholder lets the shell build.
export function generateStaticParams() {
  return [{ id: "00000000-0000-0000-0000-000000000000" }];
}

export default function ShopThreadPage({ params }: PageProps<"/sell/inbox/[id]">) {
  return (
    <Suspense fallback={<div className="pt-safe mx-auto h-dvh max-w-[760px]" />}>
      <Body params={params} />
    </Suspense>
  );
}

async function Body({ params }: { params: PageProps<"/sell/inbox/[id]">["params"] }) {
  await connection();
  const shop = await currentShop();
  if (!shop) redirect("/sell");
  const { id } = await params;
  const app = await services();
  const party = { side: "shop" as const, accountId: shop.account.id, sellerId: shop.sellerId };
  const thread = /^[0-9a-f-]{36}$/.test(id) ? await app.messaging.thread(id, party) : null;
  if (!thread) notFound();
  await app.messaging.markRead(id, party);
  const listings = (await app.selling.listings(shop.sellerId)).filter((l) => l.status === "active");
  const mentioned = thread.messages.flatMap((m) => (m.productSlug ? [m.productSlug] : []));
  const found = await app.catalog.getProductsBySlugs([...new Set(mentioned)]);
  const toChat = (p: { slug: string; title: string; images: string[]; price?: number }): ChatProduct => ({ slug: p.slug, title: p.title, image: p.images[0], price: p.price ?? null });
  const products = Object.fromEntries([...found, ...listings].map((p) => [p.slug, toChat(p)]));
  return (
    <ChatThread
      side="shop"
      conversationId={id}
      sellerId={shop.sellerId}
      title={thread.conversation.buyerName}
      avatar={null}
      verified={false}
      subtitle="Buyer"
      back="/sell/inbox"
      initial={thread.messages}
      products={products}
      shareable={listings.map(toChat)}
    />
  );
}
