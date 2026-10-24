import type { Metadata } from "next";
import { RankingsScreen } from "@/components/rankings/rankings-screen";

export const metadata: Metadata = { title: "Rankings", description: "Best sellers, most saved, top rated and rising factories, updated hourly." };

export default function RankingsPage() {
  return <RankingsScreen />;
}
