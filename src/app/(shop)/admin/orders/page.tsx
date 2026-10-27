import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ReasonButton } from "@/components/admin/admin-actions";
import { AdminEmpty, AdminFrame, AdminSearch, day, Pill, usd } from "@/components/admin/admin-frame";
import { SellSkeleton } from "@/components/sell/sell-frame";
import { refundParcelAction } from "@/server/actions/admin";
import { adminContext, param } from "@/server/admin/page";
import { ORDER_FILTERS, orderList, type OrderFilter } from "@/server/admin/queries";

export const metadata: Metadata = { title: "Admin · Orders", robots: { index: false } };

const PARCEL = {
  awaiting_shipment: { label: "To ship", tone: "warn" },
  shipped: { label: "Shipped", tone: "plain" },
  delivered: { label: "Delivered", tone: "good" },
  disputed: { label: "Disputed", tone: "bad" },
  refunded: { label: "Refunded", tone: "plain" },
} as const;

export default function OrdersPage({ searchParams }: PageProps<"/admin/orders">) {
  return (
    <Suspense fallback={<SellSkeleton />}>
      <Orders searchParams={searchParams} />
    </Suspense>
  );
}

async function Orders({ searchParams }: { searchParams: PageProps<"/admin/orders">["searchParams"] }) {
  const { app } = await adminContext();
  const sp = await searchParams;
  const q = param(sp.q);
  const filter = (ORDER_FILTERS as readonly string[]).includes(param(sp.status)) ? (param(sp.status) as OrderFilter) : "all";
  const list = await orderList(app.db, q, filter);
  return (
    <AdminFrame title="Orders" subtitle="Every order and its parcels. Refund a parcel that isn't settled, no dispute needed.">
      <AdminSearch action="/admin/orders" q={q} placeholder="Order number, buyer email or id" filters={ORDER_FILTERS} filter={filter} />
      {!list.length ? (
        <AdminEmpty>No order matches.</AdminEmpty>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {list.map((o) => (
            <li key={o.id} className="glass flex flex-col gap-2 rounded-[22px] p-3.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">
                    {o.number} · {usd(o.total)}
                    {o.kind === "deposit" && <span className="text-ink-2"> · deposit</span>}
                  </p>
                  <p className="truncate text-xs text-ink-2">
                    {o.buyerEmail ?? o.buyerId.slice(0, 8)} · {o.country} · placed {day(o.placedAt)}
                    {o.couponId && <> · coupon {o.couponId}</>}
                    {o.discount > 0 && <> (−{usd(o.discount)})</>}
                  </p>
                </div>
                <Pill tone={o.paidAt ? "good" : o.status === "cancelled" ? "plain" : "warn"}>{o.paidAt ? (o.status === "completed" ? "Completed" : "Paid") : o.status === "cancelled" ? "Cancelled" : "Unpaid"}</Pill>
              </div>
              {o.parcels.length > 0 && (
                <ul className="flex flex-col gap-1.5">
                  {o.parcels.map((p) => {
                    const s = PARCEL[p.status as keyof typeof PARCEL];
                    const open = p.status === "awaiting_shipment" || p.status === "shipped" || p.status === "disputed";
                    return (
                      <li key={p.sellerId} className="glass-inset flex flex-wrap items-center gap-2 rounded-2xl px-3 py-2">
                        <Link href={`/admin/shops?q=${p.sellerId}`} className="min-w-0 flex-1 truncate text-xs font-semibold">
                          {p.sellerId} · {usd(p.amount)}
                          {p.tracking && <span className="font-normal text-ink-2"> · {p.tracking}</span>}
                          {p.disputeReason && <span className="font-normal text-like"> · {p.disputeReason.replace(/_/g, " ")}</span>}
                        </Link>
                        <Pill tone={s?.tone ?? "plain"}>{s?.label ?? p.status}</Pill>
                        {open && <ReasonButton label="Refund" placeholder="Why (buyer and shop see this)" action={refundParcelAction.bind(null, o.id, p.sellerId)} />}
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </AdminFrame>
  );
}
