import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { Checkout } from "@/components/checkout/checkout";
import { availableRails } from "@/server/payments-config";
import { currentAccount } from "@/server/session";

export const metadata: Metadata = { title: "Checkout" };

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-[640px] px-3.5 pt-20"><div className="skeleton h-[480px] rounded-[26px]" /></div>}>
      <CheckoutBody />
    </Suspense>
  );
}

// Who's paying is per-request, so it's read behind the boundary; the bag itself is on the device.
async function CheckoutBody() {
  await connection();
  const account = await currentAccount();
  return <Checkout rails={availableRails()} signedIn={account !== null} />;
}
