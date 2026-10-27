import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { MeScreen } from "@/components/me/me-screen";
import { services } from "@/server/container";
import { currentAccount, isAdmin } from "@/server/session";
import { myShops } from "@/server/shop";

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
  const app = await services();
  const [orders, shops, unread, boards, profile] = account
    ? await Promise.all([app.getOrder.list(account.id), myShops(), app.notifications.unread(account.id), app.boards.mine(account.id), app.profiles.me(account.id)])
    : [[], [], 0, null, null];
  // The newest order's parcels drive the status pill.
  const parcels = orders[0] ? await app.fulfilment.forOrder(orders[0].id) : [];
  return (
    <MeScreen
      account={account}
      profile={profile && { handle: profile.handle, name: profile.name, avatar: profile.avatar }}
      orders={orders}
      hasShop={shops.length > 0}
      admin={isAdmin(account)}
      unread={unread}
      boards={boards?.length ?? null}
      parcels={parcels}
    />
  );
}
