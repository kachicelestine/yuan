import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ChopScreen } from "@/components/chop/chop-screen";
import { getProduct } from "@/lib/catalog";
import { chops, getChop } from "@/lib/chops";

export function generateStaticParams() {
  return chops.map((c) => ({ id: c.id }));
}

export async function generateMetadata({ params }: PageProps<"/chop/[id]">): Promise<Metadata> {
  const { id } = await params;
  const product = getProduct(getChop(id)?.slug ?? "");
  return product ? { title: `Chop: ${product.title}`, description: "Friends each cut the price toward a fixed target." } : {};
}

export default function ChopPage({ params }: PageProps<"/chop/[id]">) {
  return (
    <Suspense fallback={<div className="mx-auto max-w-[620px] px-3.5 pt-20"><div className="skeleton h-[440px] rounded-[32px]" /></div>}>
      <ChopBody params={params} />
    </Suspense>
  );
}

async function ChopBody({ params }: { params: PageProps<"/chop/[id]">["params"] }) {
  const { id } = await params;
  const chop = getChop(id);
  const product = getProduct(chop?.slug ?? "");
  if (!chop || !product) notFound();
  const others = chops.filter((c) => c.id !== id).flatMap((c) => {
    const p = getProduct(c.slug);
    return p ? [{ chop: c, product: p }] : [];
  });
  return <ChopScreen chop={chop} product={product} others={others} />;
}
