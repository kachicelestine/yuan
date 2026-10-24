"use client";

import Link from "next/link";
import { Icon } from "@/components/icon";
import { useStore } from "@/components/providers";
import { demoShipment } from "@/lib/account";

/**
 * A Live Activity for your order, like the iOS Dynamic Island: where it is and when it
 * lands, one tap from the journey. `demo` shows the sample shipment even with no orders.
 */
export function ShipmentPill({ demo = false, className = "" }: { demo?: boolean; className?: string }) {
  const { orders } = useStore();
  if (!demo && orders.length === 0) return null;
  const latest = orders[0];
  const s = demoShipment;
  const id = latest?.id ?? s.orderId;
  const stage = latest ? 1 : s.stage;
  const progress = stage / (s.steps.length - 1);
  const r = 15;
  const c = 2 * Math.PI * r;

  return (
    <Link
      href={`/orders/${id}`}
      aria-label={`Order ${id}: ${latest ? "packing in China" : `${s.steps[stage].label}, arriving ${s.eta}`}`}
      className={`glass glass-bar flex h-10 items-center gap-2 rounded-full py-1 pr-3.5 pl-1 ${className}`}
    >
      <span className="relative grid size-8 place-items-center">
        <svg viewBox="0 0 36 36" aria-hidden="true" className="absolute inset-0 -rotate-90">
          <circle cx="18" cy="18" r={r} fill="none" stroke="rgb(255 255 255 / 0.15)" strokeWidth="3" />
          <circle cx="18" cy="18" r={r} fill="none" stroke="#ff7a52" strokeWidth="3" strokeLinecap="round" strokeDasharray={`${c * progress} ${c}`} />
        </svg>
        <Icon name={latest ? "factory" : "plane"} className="size-4" />
      </span>
      <span className="flex flex-col leading-tight">
        <b className="text-[13px] font-bold">{latest ? "Packing" : `${s.to} · ${s.eta.split(",")[0]}`}</b>
        <span className="text-[10.5px] text-ink-2">{latest ? "Ships in 48 h" : "Clearing customs"}</span>
      </span>
    </Link>
  );
}
