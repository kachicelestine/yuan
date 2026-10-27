import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ConfirmButton, ReasonButton } from "@/components/admin/admin-actions";
import { AdminEmpty, AdminFrame, AdminSearch, day, Pill, usd } from "@/components/admin/admin-frame";
import { SellSkeleton } from "@/components/sell/sell-frame";
import { suspendAccountAction } from "@/server/actions/admin";
import { adminContext, param } from "@/server/admin/page";
import { users } from "@/server/admin/queries";

export const metadata: Metadata = { title: "Admin · People", robots: { index: false } };

export default function UsersPage({ searchParams }: PageProps<"/admin/users">) {
  return (
    <Suspense fallback={<SellSkeleton />}>
      <Users searchParams={searchParams} />
    </Suspense>
  );
}

async function Users({ searchParams }: { searchParams: PageProps<"/admin/users">["searchParams"] }) {
  const { app, admin } = await adminContext();
  const q = param((await searchParams).q);
  const list = await users(app.db, q);
  return (
    <AdminFrame title="People" subtitle="Every account: what they bought, the shops they run, and suspensions.">
      <AdminSearch action="/admin/users" q={q} placeholder="Email, wallet or account id" />
      {!list.length ? (
        <AdminEmpty>No one matches.</AdminEmpty>
      ) : (
        <ul className="glass flex flex-col divide-y divide-line overflow-hidden rounded-[24px]">
          {list.map((u) => (
            <li key={u.id} className="flex flex-col gap-2 px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{u.email ?? (u.wallet ? `${u.wallet.slice(0, 6)}…${u.wallet.slice(-4)}` : "No email")}</p>
                  <p className="text-xs text-ink-2">
                    Joined {day(u.joinedAt)} · {u.orders} paid orders · {usd(u.spent)}
                    {u.shops.length > 0 && <> · runs {u.shops.join(", ")}</>}
                  </p>
                  {u.suspendedAt && <p className="mt-0.5 text-xs text-like">Suspended {day(u.suspendedAt)}: {u.suspendReason}</p>}
                </div>
                {u.suspendedAt ? <Pill tone="bad">Suspended</Pill> : u.id === admin.id ? <Pill>You</Pill> : null}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Link href={`/admin/orders?q=${u.id}`} className="glass-inset h-8 rounded-full px-3 text-xs leading-8 font-semibold">
                  Orders
                </Link>
                {u.shops.map((s) => (
                  <Link key={s} href={`/admin/shops?q=${s}`} className="glass-inset h-8 rounded-full px-3 text-xs leading-8 font-semibold">
                    Shop {s}
                  </Link>
                ))}
                {u.suspendedAt ? (
                  <ConfirmButton label="Lift suspension" tone="good" action={suspendAccountAction.bind(null, u.id, null)} />
                ) : (
                  u.id !== admin.id && <ReasonButton label="Suspend" placeholder="Why (kept in the audit log)" action={suspendAccountAction.bind(null, u.id)} />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </AdminFrame>
  );
}
