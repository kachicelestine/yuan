import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { z } from "zod";
import { InvoiceScreen } from "@/components/pay/invoice-screen";
import { ownInvoice } from "@/server/invoices";
import { currentAccount } from "@/server/session";

export const metadata: Metadata = { title: "Pay", robots: { index: false } };

// An invoice is live, per-buyer state, so it is read at request time behind a skeleton.
export default function PayPage({ params, searchParams }: PageProps<"/pay/[id]">) {
  return (
    <Suspense fallback={<div className="mx-auto max-w-[520px] px-3.5 pt-20"><div className="skeleton h-[560px] rounded-[30px]" /></div>}>
      <PayBody params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function PayBody({ params, searchParams }: Pick<PageProps<"/pay/[id]">, "params" | "searchParams">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  // Live payment state: always read at request time.
  await connection();
  if (!z.uuid().safeParse(id).success) notFound();
  const account = await currentAccount();
  if (!account) redirect(`/signin?next=${encodeURIComponent(`/pay/${id}`)}`);
  // Someone else's invoice looks the same as one that doesn't exist.
  const owned = await ownInvoice(id, account.id);
  if (!owned) notFound();
  return <InvoiceScreen initial={owned.invoice} orderNumber={owned.orderNumber} priceUpdated={query.updated === "1"} />;
}
