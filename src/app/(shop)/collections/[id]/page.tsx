import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { BoardScreen, SavedBoardScreen } from "@/components/collections/collections";
import { getProductsBySlugs } from "@/server/catalog";
import { services } from "@/server/container";
import { currentAccount } from "@/server/session";

export const metadata: Metadata = { title: "Board" };

// Boards are made by people, so only "All saved" is prerendered; the rest render per request.
export function generateStaticParams() {
  return [{ id: "saved" }];
}

export default function BoardPage({ params }: PageProps<"/collections/[id]">) {
  return (
    <Suspense fallback={<div className="skeleton pt-safe mx-3.5 mt-16 h-72 rounded-[26px]" />}>
      <BoardBody params={params} />
    </Suspense>
  );
}

async function BoardBody({ params }: { params: PageProps<"/collections/[id]">["params"] }) {
  const { id } = await params;
  if (id === "saved") return <SavedBoardScreen />;
  await connection();
  const account = await currentAccount();
  const board = await (await services()).boards.view(id, account?.id ?? null);
  if (!board) notFound();
  const products = board.slugs.length ? await getProductsBySlugs(board.slugs) : [];
  return <BoardScreen initial={board} products={products} signedIn={!!account} />;
}
