import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { OrderJourney } from "@/components/orders/order-journey";
import { demoShipment } from "@/lib/account";
import { services } from "@/server/container";
import { currentAccount } from "@/server/session";

export const metadata: Metadata = { title: "Your order" };

export function generateStaticParams() {
  return [{ id: demoShipment.orderId }];
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
  // An order's status changes as it's paid and shipped, so it's read fresh on every request.
  await connection();
  // The sample shipment is public; real orders are shown only to the buyer who placed them.
  if (id === demoShipment.orderId) return <OrderJourney />;
  const account = await currentAccount();
  if (!account) redirect(`/signin?next=${encodeURIComponent(`/orders/${id}`)}`);
  const placed = await (await services()).getOrder.byNumber(id, account.id);
  if (!placed) notFound();
  return <OrderJourney placed={placed} />;
}
