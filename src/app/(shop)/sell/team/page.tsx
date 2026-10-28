import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { SellFrame, SellSkeleton } from "@/components/sell/sell-frame";
import { TeamManager } from "@/components/sell/team-manager";
import { services } from "@/server/container";
import { currentShop } from "@/server/shop";

export const metadata: Metadata = { title: "Team", robots: { index: false } };

export default function TeamPage() {
  return (
    <Suspense fallback={<SellSkeleton />}>
      <TeamBody />
    </Suspense>
  );
}

async function TeamBody() {
  await connection();
  const shop = await currentShop();
  if (!shop) redirect("/sell");
  const app = await services();
  const [members, invites] = await Promise.all([app.team.members(shop.sellerId), app.team.pending(shop.sellerId)]);
  const people = await app.profiles.actors(members.map((m) => m.accountId));
  const owner = shop.role === "owner";
  return (
    <SellFrame title="Team" back="/sell" subtitle="The people who run your shop.">
      <TeamManager
        owner={owner}
        members={members.map((m) => {
          const p = people.get(m.accountId)!;
          return { ...m, name: p.name, handle: p.handle, avatar: p.avatar, you: m.accountId === shop.account.id };
        })}
        invites={owner ? invites.map((i) => ({ id: i.id, email: i.email, createdAt: i.createdAt })) : []}
      />
    </SellFrame>
  );
}
