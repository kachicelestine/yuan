import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { MeScreen } from "@/components/me/me-screen";
import { services } from "@/server/container";
import { currentAccount } from "@/server/session";

export const metadata: Metadata = { title: "Me" };

export default function MePage() {
  // The device-side hub renders straight away; the account and its orders stream in.
  return (
    <Suspense fallback={<MeScreen />}>
      <MeBody />
    </Suspense>
  );
}

async function MeBody() {
  // Who's signed in, and their orders, are per request.
  await connection();
  const account = await currentAccount();
  const orders = account ? await (await services()).getOrder.list(account.id) : [];
  return <MeScreen account={account} orders={orders} />;
}
