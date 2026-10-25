import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { UnboxScreen } from "@/components/unbox/unbox-screen";
import { getProduct } from "@/server/catalog";
import { services } from "@/server/container";
import { currentAccount } from "@/server/session";

export const metadata: Metadata = { title: "Pick a box", description: "Choose a sealed blind box from a real case, shake it for a hint, then open it." };

// Cases change with every box sold, so the machine renders per request.
export function generateStaticParams() {
  return [{ id: "night-market-1" }];
}

export default function UnboxPage({ params }: PageProps<"/unbox/[id]">) {
  return (
    <Suspense fallback={<div className="skeleton pt-safe mx-3.5 mt-16 h-[520px] rounded-[32px] lg:mx-auto lg:max-w-[760px]" />}>
      <Body params={params} />
    </Suspense>
  );
}

async function Body({ params }: { params: PageProps<"/unbox/[id]">["params"] }) {
  await connection();
  const { id } = await params;
  const account = await currentAccount();
  const machine = await (await services()).blindBoxes.machine(id, account?.id ?? null);
  if (!machine) notFound();
  const product = await getProduct(machine.series.slug);
  if (product?.price === undefined) notFound();
  return <UnboxScreen initial={machine} price={product.price} signedIn={!!account} />;
}
