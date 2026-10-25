import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { TeamScreen } from "@/components/team/team-screen";
import { services } from "@/server/container";
import { currentAccount } from "@/server/session";

export const metadata: Metadata = { title: "Team buy", description: "Join the team and everyone gets the team price." };

// Teams are started by people as they shop, so nothing is prerendered; the placeholder lets the shell build.
export function generateStaticParams() {
  return [{ id: "aaaaaaaa" }];
}

export default function TeamPage({ params }: PageProps<"/team/[id]">) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-[620px] px-3.5 pt-20">
          <div className="skeleton h-[440px] rounded-[32px]" />
        </div>
      }
    >
      <TeamBody params={params} />
    </Suspense>
  );
}

async function TeamBody({ params }: { params: PageProps<"/team/[id]">["params"] }) {
  await connection();
  const { id } = await params;
  const app = await services();
  const account = await currentAccount();
  const team = await app.promos.team(id, account?.id ?? null);
  if (!team) notFound();
  const [p] = await app.catalog.getProductsBySlugs([team.slug]);
  if (!p) notFound();
  return <TeamScreen initial={team} product={{ slug: p.slug, title: p.title, image: p.images[0], price: p.price ?? null }} />;
}
