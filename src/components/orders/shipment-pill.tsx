"use client";

import Link from "next/link";
import { Icon, type IconName } from "@/components/icon";
import type { OrderView, ShipmentView } from "@/modules/ordering";

/** Where the newest order is, in one glance, like a Live Activity: one tap to its page. */
export function ShipmentPill({ order, parcels, className = "" }: { order: OrderView; parcels: ShipmentView[]; className?: string }) {
  const [icon, title, sub, progress]: [IconName, string, string, number] =
    order.status === "awaiting_payment"
      ? ["card", "Waiting to pay", `Order ${order.number}`, 0.05]
      : order.status === "cancelled" || order.status === "completed"
        ? ["check", order.status === "completed" ? "Delivered" : "Cancelled", `Order ${order.number}`, order.status === "completed" ? 1 : 0]
        : parcels.some((p) => p.status === "disputed")
          ? ["shield", "Problem reported", "Payment held", 0.5]
          : parcels.length && parcels.every((p) => p.status === "delivered" || p.status === "refunded")
            ? ["check", "Delivered", "Confirm it on the order", 1]
            : parcels.some((p) => p.status === "shipped" || p.status === "delivered")
              ? ["plane", "On its way", `${parcels.filter((p) => p.tracking).length} of ${parcels.length} shipped`, 0.6]
              : ["factory", "Packing", "The shop ships it next", 0.25];
  // Settled orders don't need a pill.
  if (order.status === "completed" || order.status === "cancelled") return null;
  const r = 15;
  const c = 2 * Math.PI * r;

  return (
    <Link href={`/orders/${order.number}`} aria-label={`Order ${order.number}: ${title}`} className={`glass glass-bar flex h-10 items-center gap-2 rounded-full py-1 pr-3.5 pl-1 ${className}`}>
      <span className="relative grid size-8 place-items-center">
        <svg viewBox="0 0 36 36" aria-hidden="true" className="absolute inset-0 -rotate-90">
          <circle cx="18" cy="18" r={r} fill="none" stroke="rgb(255 255 255 / 0.15)" strokeWidth="3" />
          <circle cx="18" cy="18" r={r} fill="none" stroke="#ff7a52" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${c * progress} ${c}`} />
        </svg>
        <Icon name={icon} className="size-4" />
      </span>
      <span className="flex flex-col leading-tight">
        <b className="text-[13px] font-bold">{title}</b>
        <span className="text-[10.5px] text-ink-2">{sub}</span>
      </span>
    </Link>
  );
}
