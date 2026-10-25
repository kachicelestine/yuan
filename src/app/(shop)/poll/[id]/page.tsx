import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { PollScreen } from "@/components/poll/poll-screen";
import { services } from "@/server/container";
import { currentAccount } from "@/server/session";
import { readVoter } from "@/server/voter";

export const metadata: Metadata = { title: "Ask friends", description: "Vote with one tap, no sign-up." };

// Polls are made by people as they shop, so nothing is prerendered; the placeholder lets the shell build.
export function generateStaticParams() {
  return [{ id: "aaaaaaaa" }];
}

export default function PollPage({ params }: PageProps<"/poll/[id]">) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-[620px] px-3.5 pt-20">
          <div className="skeleton h-[480px] rounded-[30px]" />
        </div>
      }
    >
      <PollBody params={params} />
    </Suspense>
  );
}

async function PollBody({ params }: { params: PageProps<"/poll/[id]">["params"] }) {
  await connection();
  const { id } = await params;
  const app = await services();
  const account = await currentAccount();
  const poll = await app.polls.view(id, { voter: account?.id ?? (await readVoter()), accountId: account?.id ?? null });
  if (!poll) notFound();
  const products = await app.catalog.getProductsBySlugs(poll.options.map((o) => o.slug));
  return <PollScreen initial={poll} products={Object.fromEntries(products.map((p) => [p.slug, { title: p.title, image: p.images[0], price: p.price ?? null }]))} />;
}
