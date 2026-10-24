import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { NotificationList } from "@/components/notifications/notification-list";
import { SellFrame, SellSkeleton } from "@/components/sell/sell-frame";
import { services } from "@/server/container";
import { currentAccount } from "@/server/session";

export const metadata: Metadata = { title: "Notifications" };

export default function NotificationsPage() {
  return (
    <Suspense fallback={<SellSkeleton />}>
      <NotificationsBody />
    </Suspense>
  );
}

async function NotificationsBody() {
  await connection();
  const account = await currentAccount();
  if (!account) redirect("/signin?next=/notifications");
  return (
    <SellFrame title="Notifications">
      <NotificationList items={await (await services()).notifications.list(account.id)} />
    </SellFrame>
  );
}
