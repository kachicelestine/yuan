import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { SellFrame, SellSkeleton } from "@/components/sell/sell-frame";
import { AccountControls } from "@/components/me/account-controls";
import { ProfileEditor } from "@/components/social/profile-editor";
import { services } from "@/server/container";
import { currentAccount } from "@/server/session";

export const metadata: Metadata = { title: "Edit profile", robots: { index: false } };

export default function EditProfilePage() {
  return (
    <Suspense fallback={<SellSkeleton />}>
      <EditBody />
    </Suspense>
  );
}

async function EditBody() {
  await connection();
  const account = await currentAccount();
  if (!account) redirect("/signin?next=/me/profile");
  const p = await (await services()).profiles.me(account.id);
  return (
    <SellFrame title="Edit profile" subtitle="What everyone sees next to your posts and comments.">
      <div className="mx-auto max-w-[480px]">
        <ProfileEditor initial={{ handle: p.handle, name: p.name, bio: p.bio, avatar: p.avatar }} />
        <AccountControls />
      </div>
    </SellFrame>
  );
}
