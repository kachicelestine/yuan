import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { ConfirmButton, ReasonButton } from "@/components/admin/admin-actions";
import { AdminEmpty, AdminFrame, AdminSearch, day, Pill, usd } from "@/components/admin/admin-frame";
import { SellSkeleton } from "@/components/sell/sell-frame";
import { suspendShopAction, verifyShopAction } from "@/server/actions/admin";
import { adminContext, param } from "@/server/admin/page";
import { shops } from "@/server/admin/queries";

export const metadata: Metadata = { title: "Admin · Shops", robots: { index: false } };

export default function ShopsPage({ searchParams }: PageProps<"/admin/shops">) {
  return (
    <Suspense fallback={<SellSkeleton />}>
      <Shops searchParams={searchParams} />
    </Suspense>
  );
}

async function Shops({ searchParams }: { searchParams: PageProps<"/admin/shops">["searchParams"] }) {
  const { app } = await adminContext();
  const q = param((await searchParams).q);
  const list = await shops(app.db, new Date(), q);
  return (
    <AdminFrame title="Shops" subtitle="Badges, suspensions, sales and what each shop is owed.">
      <AdminSearch action="/admin/shops" q={q} placeholder="Shop name, id or city" />
      {!list.length ? (
        <AdminEmpty>No shop matches.</AdminEmpty>
      ) : (
        <ul className="glass flex flex-col divide-y divide-line overflow-hidden rounded-[24px]">
          {list.map((s) => (
            <li key={s.id} className="flex flex-col gap-2 px-4 py-3">
              <div className="flex items-start gap-3">
                {s.avatar ? <Image src={s.avatar} alt="" width={40} height={40} sizes="40px" className="size-10 shrink-0 rounded-full object-cover" /> : <span className="size-10 shrink-0 rounded-full bg-white/10" />}
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-sm font-semibold">
                    <span className="truncate">{s.name}</span>
                    {s.verified && <Pill tone="good">Verified</Pill>}
                    {s.suspendedAt && <Pill tone="bad">Suspended</Pill>}
                    {s.openDisputes > 0 && <Pill tone="warn">{s.openDisputes} disputed</Pill>}
                  </p>
                  <p className="text-xs text-ink-2">
                    {s.id} · {s.kind} · {s.city} · {s.listings} live listings
                  </p>
                  <p className="text-xs text-ink-2">
                    {usd(s.sales)} sold in 30 days · owed {usd(s.balance)}
                  </p>
                  {s.suspendedAt && (
                    <p className="mt-0.5 text-xs text-like">
                      Suspended {day(s.suspendedAt)}: {s.suspendReason}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {!s.suspendedAt && (
                  <Link href={`/s/${s.id}`} target="_blank" className="glass-inset h-8 rounded-full px-3 text-xs leading-8 font-semibold">
                    Open shop
                  </Link>
                )}
                <Link href={`/admin/listings?q=${s.id}`} className="glass-inset h-8 rounded-full px-3 text-xs leading-8 font-semibold">
                  Listings
                </Link>
                <ConfirmButton label={s.verified ? "Remove badge" : "Verify"} tone={s.verified ? "plain" : "good"} action={verifyShopAction.bind(null, s.id, !s.verified)} />
                {s.suspendedAt ? (
                  <ConfirmButton label="Lift suspension" tone="good" action={suspendShopAction.bind(null, s.id, null)} />
                ) : (
                  <ReasonButton label="Suspend shop" placeholder="Why (the shop sees this)" action={suspendShopAction.bind(null, s.id)} />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </AdminFrame>
  );
}
