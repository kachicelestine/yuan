import { ConfirmButton } from "@/components/admin/admin-actions";
import type { ManagedCouponView } from "@/modules/engagement";

type Done = { ok: true } | { ok: false; message: string };

export function couponHeadline(c: Pick<ManagedCouponView, "kind" | "value">) {
  return c.kind === "amount" ? `$${c.value % 1 ? c.value.toFixed(2) : c.value} off` : c.kind === "percent" ? `${Math.round(c.value * 100)}% off` : "Free shipping";
}

/** Coupons with how far they've gone, and a way to end each one early. */
export function ManagedCoupons({ list, end, showShop }: { list: ManagedCouponView[]; end: (id: string) => Promise<Done>; showShop?: boolean }) {
  if (!list.length) return <p className="glass-inset rounded-[22px] p-4 text-sm text-ink-2">No coupons yet.</p>;
  return (
    <ul className="glass flex flex-col divide-y divide-line overflow-hidden rounded-[24px]">
      {list.map((c) => (
        <li key={c.id} className={`flex items-center gap-3 px-4 py-3 ${c.running ? "" : "opacity-60"}`}>
          <span className="w-[84px] shrink-0 font-display text-base leading-tight font-extrabold">{couponHeadline(c)}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{c.title !== couponHeadline(c) ? c.title : c.detail}</span>
            <span className="block truncate text-xs text-ink-2">
              over ${c.minSpend} · {c.claimed} claimed · {c.used} used · {c.running ? "ends" : "ended"} {new Date(c.expiresAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
              {showShop && <> · {c.sellerId ?? "platform"}</>}
            </span>
          </span>
          {c.running && <ConfirmButton label="End" tone="danger" confirm="End now?" action={end.bind(null, c.id)} />}
        </li>
      ))}
    </ul>
  );
}
