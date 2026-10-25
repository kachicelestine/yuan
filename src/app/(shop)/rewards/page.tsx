import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { RewardsScreen } from "@/components/rewards/rewards-screen";
import { services } from "@/server/container";
import { currentAccount } from "@/server/session";

export const metadata: Metadata = { title: "Rewards" };

export default function RewardsPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-[760px] px-3.5 pt-20">
          <div className="skeleton h-[480px] rounded-[30px]" />
        </div>
      }
    >
      <RewardsBody />
    </Suspense>
  );
}

async function RewardsBody() {
  await connection();
  const account = await currentAccount();
  return <RewardsScreen progress={await (await services()).rewards.view(account?.id ?? null)} />;
}
