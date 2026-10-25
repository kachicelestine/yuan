import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { CollectionsScreen } from "@/components/collections/collections";
import { getProductsBySlugs } from "@/server/catalog";
import { services } from "@/server/container";
import { currentAccount } from "@/server/session";

export const metadata: Metadata = { title: "Collections" };

export default function CollectionsPage() {
  return (
    <Suspense fallback={<div className="skeleton pt-safe mx-3.5 mt-16 h-72 rounded-[26px]" />}>
      <CollectionsBody />
    </Suspense>
  );
}

async function CollectionsBody() {
  // Your boards and who follows what are per request.
  await connection();
  const account = await currentAccount();
  const app = await services();
  const [mine, followed, popular] = await Promise.all([account ? app.boards.mine(account.id) : [], account ? app.boards.followed(account.id) : [], app.boards.popular(account?.id ?? null)]);
  // Cover photos: the first four products of each board.
  const slugs = [...new Set([...mine, ...followed, ...popular].flatMap((b) => b.slugs.slice(0, 4)))];
  const products = slugs.length ? await getProductsBySlugs(slugs) : [];
  const covers = Object.fromEntries(products.map((p) => [p.slug, p.images[0]]));
  return <CollectionsScreen signedIn={!!account} mine={mine} followed={followed} popular={popular} covers={covers} />;
}
