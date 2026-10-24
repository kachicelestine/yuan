import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { LiveRoom, type LiveRoomItem } from "@/components/live/live-room";
import { getProduct, getSeller } from "@/lib/catalog";
import { getLiveRoom, livePurchases, liveRooms } from "@/lib/live";

export function generateStaticParams() {
  return liveRooms.map((r) => ({ id: r.id }));
}

export async function generateMetadata({ params }: PageProps<"/live/[id]">): Promise<Metadata> {
  const { id } = await params;
  const room = getLiveRoom(id);
  return room ? { title: `Live: ${room.title}` } : {};
}

export default function LiveRoomPage({ params }: PageProps<"/live/[id]">) {
  return (
    <Suspense fallback={<div className="fixed inset-0 bg-black lg:relative lg:mx-auto lg:aspect-[9/16] lg:h-full lg:rounded-[28px]" />}>
      <RoomBody params={params} />
    </Suspense>
  );
}

async function RoomBody({ params }: { params: PageProps<"/live/[id]">["params"] }) {
  const { id } = await params;
  const room = getLiveRoom(id);
  if (!room) notFound();
  const items: LiveRoomItem[] = room.items.flatMap((i) => {
    const product = getProduct(i.slug);
    return product ? [{ product, livePrice: i.livePrice, status: i.status }] : [];
  });
  return (
    <LiveRoom
      host={room.hostName}
      seller={getSeller(room.sellerId)}
      title={room.title}
      image={room.image}
      place={room.place}
      viewers={room.viewers}
      items={items}
      comments={room.comments}
      pinned={room.pinned}
      purchases={livePurchases}
    />
  );
}
