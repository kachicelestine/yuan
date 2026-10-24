import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChatThread } from "@/components/inbox/chat-thread";
import { getSeller, getSellerProfile, sellers } from "@/lib/catalog";
import { getThread } from "@/lib/inbox";

export function generateStaticParams() {
  return Object.keys(sellers).map((id) => ({ id }));
}

export async function generateMetadata({ params }: PageProps<"/inbox/[id]">): Promise<Metadata> {
  const { id } = await params;
  const seller = getSeller(id);
  return seller ? { title: `Chat with ${seller.name}` } : {};
}

export default function ThreadPage({ params }: PageProps<"/inbox/[id]">) {
  return (
    <Suspense fallback={<div className="pt-safe mx-auto h-dvh max-w-[760px]" />}>
      <ThreadBody params={params} />
    </Suspense>
  );
}

async function ThreadBody({ params }: { params: PageProps<"/inbox/[id]">["params"] }) {
  const { id } = await params;
  const seller = getSeller(id);
  if (!seller) notFound();
  // A first chat opens with the seller's greeting, translated like every other message.
  const messages = getThread(id)?.messages ?? [
    { id: "hello", from: "seller" as const, text: `Hi, this is ${seller.name}. Ask us anything: stock, custom orders, shipping to your country.`, original: `您好，这里是${seller.name}。库存、定制、发货到您的国家，都可以问我们。`, at: "Now" },
  ];
  return <ChatThread seller={seller} replyHours={getSellerProfile(id)?.responseHours ?? 4} initial={messages} />;
}
