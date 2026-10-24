import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Auction } from "@/components/live/auction";
import { LiveRoom } from "@/components/live/live-room";
import { getSellerPage } from "@/server/catalog";
import { services } from "@/server/container";

// Rooms change by the second, so the body renders per request; the shell is instant.
export function generateStaticParams() {
  return [{ id: "auction" }];
}

export const metadata: Metadata = { title: "Live" };

export default function LiveRoomPage({ params }: PageProps<"/live/[id]">) {
  return (
    <Suspense fallback={<div className="fixed inset-0 bg-black lg:relative lg:mx-auto lg:aspect-[9/16] lg:h-full lg:rounded-[28px]" />}>
      <RoomBody params={params} />
    </Suspense>
  );
}

async function RoomBody({ params }: { params: PageProps<"/live/[id]">["params"] }) {
  await connection();
  const { id } = await params;
  if (id.length > 64) notFound();
  const app = await services();
  const room = await app.live.show(id);
  if (!room) notFound();
  const slugs = [...new Set([...room.show.items.map((i) => i.slug), ...room.lots.map((l) => l.slug)])];
  const [page, list] = await Promise.all([getSellerPage(room.show.sellerId), app.catalog.getProductsBySlugs(slugs)]);
  if (!page) notFound();
  const products = Object.fromEntries(list.map((p) => [p.slug, p]));
  const props = { show: room.show, seller: page.seller, messages: room.messages, lots: room.lots, products };
  return room.show.kind === "auction" ? <Auction {...props} /> : <LiveRoom {...props} />;
}
