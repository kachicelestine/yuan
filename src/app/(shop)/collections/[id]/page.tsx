import type { Metadata } from "next";
import { Suspense } from "react";
import { BoardScreen } from "@/components/collections/collections";
import { boards } from "@/lib/account";

export const metadata: Metadata = { title: "Board" };

export function generateStaticParams() {
  return [{ id: "saved" }, ...boards.map((b) => ({ id: b.id }))];
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
  return <BoardScreen id={id} />;
}
