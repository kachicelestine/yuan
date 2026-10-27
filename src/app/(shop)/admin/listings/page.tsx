import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { ConfirmButton, ReasonButton } from "@/components/admin/admin-actions";
import { AdminEmpty, AdminFrame, AdminSearch, day, Pill, usd } from "@/components/admin/admin-frame";
import { SellSkeleton } from "@/components/sell/sell-frame";
import { removeListingAction } from "@/server/actions/admin";
import { adminContext, param } from "@/server/admin/page";
import { LISTING_FILTERS, listings, type ListingFilter } from "@/server/admin/queries";

export const metadata: Metadata = { title: "Admin · Listings", robots: { index: false } };

const TONE = { active: "good", removed: "bad", suspended: "bad", draft: "plain", archived: "plain" } as const;

export default function ListingsPage({ searchParams }: PageProps<"/admin/listings">) {
  return (
    <Suspense fallback={<SellSkeleton />}>
      <Listings searchParams={searchParams} />
    </Suspense>
  );
}

async function Listings({ searchParams }: { searchParams: PageProps<"/admin/listings">["searchParams"] }) {
  const { app } = await adminContext();
  const sp = await searchParams;
  const q = param(sp.q);
  const status = (LISTING_FILTERS as readonly string[]).includes(param(sp.status)) ? (param(sp.status) as ListingFilter) : "all";
  const list = await listings(app.db, q, status);
  return (
    <AdminFrame title="Listings" subtitle="Take down what breaks the rules; the seller sees why.">
      <AdminSearch action="/admin/listings" q={q} placeholder="Title, slug or shop id" filters={LISTING_FILTERS} filter={status} />
      {!list.length ? (
        <AdminEmpty>No listing matches.</AdminEmpty>
      ) : (
        <ul className="glass flex flex-col divide-y divide-line overflow-hidden rounded-[24px]">
          {list.map((p) => (
            <li key={p.id} className="flex gap-3 px-4 py-3">
              {p.image ? <Image src={p.image} alt="" width={56} height={56} sizes="56px" className="size-14 shrink-0 rounded-xl object-cover" /> : <span className="size-14 shrink-0 rounded-xl bg-white/10" />}
              <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="line-clamp-2 text-sm font-semibold">{p.title}</p>
                  <Pill tone={TONE[p.status as keyof typeof TONE] ?? "plain"}>{p.status}</Pill>
                </div>
                <p className="text-xs text-ink-2">
                  {p.sellerName} · {p.price === null ? "Quote only" : usd(p.price)} · {p.sold.toLocaleString()} sold · edited {day(p.updatedAt)}
                </p>
                {p.moderationNote && <p className="text-xs text-like">Removed: {p.moderationNote}</p>}
                <div className="flex flex-wrap gap-1.5">
                  {p.status === "active" && (
                    <Link href={`/p/${p.slug}`} target="_blank" className="glass-inset h-8 rounded-full px-3 text-xs leading-8 font-semibold">
                      Open
                    </Link>
                  )}
                  {p.status === "removed" ? (
                    <ConfirmButton label="Put back up" tone="good" action={removeListingAction.bind(null, p.id, null)} />
                  ) : (
                    p.status !== "suspended" && <ReasonButton label="Take down" placeholder="Why (the seller sees this)" action={removeListingAction.bind(null, p.id)} />
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </AdminFrame>
  );
}
