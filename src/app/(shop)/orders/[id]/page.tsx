import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { OrderJourney } from "@/components/orders/order-journey";
import { getSellers } from "@/server/catalog";
import { services } from "@/server/container";
import { currentAccount } from "@/server/session";

export const metadata: Metadata = { title: "Your order", robots: { index: false } };

// Orders are private and change as they're paid and shipped; the placeholder lets the shell build.
export function generateStaticParams() {
  return [{ id: "LY-000000" }];
}

export default function OrderPage({ params }: PageProps<"/orders/[id]">) {
  return (
    <Suspense fallback={<div className="skeleton pt-safe mx-3.5 mt-16 h-64 rounded-[30px] lg:mx-auto lg:max-w-[700px]" />}>
      <OrderBody params={params} />
    </Suspense>
  );
}

async function OrderBody({ params }: { params: PageProps<"/orders/[id]">["params"] }) {
  const { id } = await params;
  await connection();
  // Shown only to the buyer who placed it.
  const account = await currentAccount();
  if (!account) redirect(`/signin?next=${encodeURIComponent(`/orders/${id}`)}`);
  const app = await services();
  const placed = await app.getOrder.byNumber(id, account.id);
  if (!placed) notFound();
  const [parcels, sellers, reviewed, gift, invoiceId] = await Promise.all([
    app.fulfilment.forOrder(placed.id),
    getSellers(),
    app.interactions.reviewed(placed.id, [...new Set(placed.lines.map((l) => l.slug))]),
    app.gifts.forSender(account.id, placed.id),
    placed.status === "awaiting_payment" ? app.invoiceIdFor(placed.id) : Promise.resolve(null),
  ]);
  const shops = Object.fromEntries(sellers.filter((s) => parcels.some((p) => p.sellerId === s.id)).map((s) => [s.id, { name: s.name, avatar: s.avatar }]));
  return <OrderJourney placed={placed} parcels={parcels} shops={shops} reviewed={reviewed} gift={gift} invoiceId={invoiceId} />;
}
