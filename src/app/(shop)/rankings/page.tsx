import type { Metadata } from "next";
import { Suspense } from "react";
import { RankingsScreen } from "@/components/rankings/rankings-screen";
import { getRankings } from "@/server/rankings";

export const metadata: Metadata = { title: "Rankings", description: "Best sellers, most saved, top rated and rising factories, from real orders, updated hourly." };

export default function RankingsPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-[1000px] px-3.5 pt-20">
          <div className="skeleton h-[480px] rounded-[26px]" />
        </div>
      }
    >
      <Initial />
    </Suspense>
  );
}

async function Initial() {
  return <RankingsScreen initial={await getRankings("hot", "week")} />;
}
