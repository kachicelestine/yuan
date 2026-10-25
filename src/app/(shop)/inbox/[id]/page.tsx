import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ChatThread, type ChatProduct } from "@/components/inbox/chat-thread";
import { getSellerPage } from "@/server/catalog";
import { services } from "@/server/container";
import { currentAccount } from "@/server/session";

export const metadata: Metadata = { title: "Chat", robots: { index: false } };

// Shops come from the database, so nothing is prerendered; the placeholder lets the shell build.
export function generateStaticParams() {
  return [{ id: "shop" }];
}

export default function ThreadPage({ params, searchParams }: PageProps<"/inbox/[id]">) {
  return (
    <Suspense fallback={<div className="pt-safe mx-auto h-dvh max-w-[760px]" />}>
      <ThreadBody params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function ThreadBody({ params, searchParams }: { params: PageProps<"/inbox/[id]">["params"]; searchParams: PageProps<"/inbox/[id]">["searchParams"] }) {
  await connection();
  const [{ id }, { about }] = await Promise.all([params, searchParams]);
  const page = await getSellerPage(id);
  if (!page) notFound();
  const app = await services();
  const account = await currentAccount();
  const thread = account ? await app.messaging.withShop(account.id, id) : { conversation: null, messages: [] };
  if (thread.conversation) await app.messaging.markRead(thread.conversation.id, { side: "buyer", accountId: account!.id, name: "" });
  const aboutSlug = typeof about === "string" && /^[a-z0-9-]{1,80}$/.test(about) ? about : null;
  const slugs = [...new Set([...thread.messages.flatMap((m) => (m.productSlug ? [m.productSlug] : [])), ...(aboutSlug ? [aboutSlug] : [])])];
  const found = await app.catalog.getProductsBySlugs(slugs);
  const products: Record<string, ChatProduct> = Object.fromEntries(found.map((p) => [p.slug, { slug: p.slug, title: p.title, image: p.images[0], price: p.price ?? null }]));
  const hours = page.storefront?.responseHours;
  return (
    <ChatThread
      side="buyer"
      conversationId={thread.conversation?.id ?? null}
      sellerId={id}
      title={page.seller.name}
      avatar={page.seller.avatar}
      verified={page.seller.verified}
      subtitle={hours ? `Usually replies within ${hours} h` : page.seller.city}
      back="/inbox"
      initial={thread.messages}
      products={products}
      about={aboutSlug && products[aboutSlug] && !thread.messages.some((m) => m.productSlug === aboutSlug) ? products[aboutSlug] : null}
    />
  );
}
