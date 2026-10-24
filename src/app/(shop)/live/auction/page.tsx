import type { Metadata } from "next";
import { Auction } from "@/components/live/auction";
import { auctionRoom, getSeller } from "@/lib/catalog";

export const metadata: Metadata = { title: "Live auction" };

export default function AuctionPage() {
  return <Auction host={auctionRoom.hostName} seller={getSeller(auctionRoom.sellerId)} image={auctionRoom.image} lots={auctionRoom.lots} />;
}

