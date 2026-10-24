import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { UnboxScreen } from "@/components/unbox/unbox-screen";
import { demoCase, nightMarket } from "@/lib/blindbox";
import { getProduct } from "@/lib/catalog";

export const metadata: Metadata = { title: "Pick a box", description: "Choose a sealed blind box from a real case, shake it for a hint, then open it." };

export default function UnboxPage() {
  const product = getProduct(nightMarket.slug);
  if (!product) notFound();
  return <UnboxScreen series={nightMarket} product={product} demo={demoCase} />;
}
