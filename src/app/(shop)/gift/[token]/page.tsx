import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { GiftUnwrap } from "@/components/gift/gift-unwrap";
import { getProduct } from "@/server/catalog";
import { services } from "@/server/container";

// A private link: never indexed, never cached.
export const metadata: Metadata = { title: "You've got a gift", description: "Unwrap it, pick your size and tell us where to send it.", robots: { index: false } };

// Gifts are made by people, so nothing is prerendered; the placeholder lets the shell build.
export function generateStaticParams() {
  return [{ token: "aaaaaaaaaaaaaaaaaaaaaaaa" }];
}

export default function GiftPage({ params }: PageProps<"/gift/[token]">) {
  return (
    <Suspense fallback={<div className="mx-auto mt-24 size-[230px] skeleton rounded-[30px]" />}>
      <Body params={params} />
    </Suspense>
  );
}

async function Body({ params }: { params: PageProps<"/gift/[token]">["params"] }) {
  await connection();
  const { token } = await params;
  const gift = await (await services()).gifts.view(token);
  if (!gift) notFound();
  const product = await getProduct(gift.slug);
  const choices = gift.chooseOption ? (product?.options?.find((o) => o.name === gift.chooseOption)?.values.map((v) => v.label) ?? []) : [];
  return <GiftUnwrap initial={gift} choices={choices} delivery={product?.delivery ?? null} />;
}
