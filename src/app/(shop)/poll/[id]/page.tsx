import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PollScreen } from "@/components/poll/poll-screen";
import { getPoll, polls } from "@/lib/polls";

export function generateStaticParams() {
  return [...polls.map((p) => ({ id: p.id })), { id: "mine" }];
}

export async function generateMetadata({ params }: PageProps<"/poll/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: getPoll(id)?.question ?? "Ask friends", description: "Vote with one tap, no sign-up." };
}

export default function PollPage({ params }: PageProps<"/poll/[id]">) {
  return (
    <Suspense fallback={<div className="mx-auto max-w-[620px] px-3.5 pt-20"><div className="skeleton h-[480px] rounded-[30px]" /></div>}>
      <PollBody params={params} />
    </Suspense>
  );
}

// "mine" lives in the browser, so the client screen fills it in; fixture polls render here.
async function PollBody({ params }: { params: PageProps<"/poll/[id]">["params"] }) {
  const { id } = await params;
  const poll = getPoll(id) ?? null;
  if (!poll && id !== "mine") notFound();
  return <PollScreen fixture={poll} />;
}
