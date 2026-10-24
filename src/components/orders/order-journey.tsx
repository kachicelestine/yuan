"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/icon";
import { Flag } from "@/components/market/flag";
import { useMoney } from "@/components/price";
import { useStore } from "@/components/providers";
import { Sheet, type Detent } from "@/components/sheet";
import { brand } from "@/config/brand";
import { demoShipment } from "@/lib/account";
import { getProduct, type Shipment } from "@/lib/catalog";
import { shiftDelivery } from "@/lib/landed";
import type { OrderView } from "@/modules/ordering";

const problems = ["It hasn't arrived", "It arrived damaged", "It's not as described", "Wrong item or size", "Something else"];

/** Turns a just-placed order into a shipment at its first steps. */
function fromOrder(order: { id: string; total: number; lines: { slug: string; qty: number; option?: string; unitPrice: number }[] }, city: string, code: string, extraDays: number): Shipment {
  const first = getProduct(order.lines[0]?.slug ?? "");
  return {
    ...demoShipment,
    orderId: order.id,
    to: city,
    toCode: code,
    from: first?.shipsFrom ?? "Shenzhen",
    eta: first ? shiftDelivery(first.delivery, extraDays) : demoShipment.eta,
    stage: 1,
    lines: order.lines,
    total: order.total,
    tracking: "Assigned when it ships",
    steps: demoShipment.steps.map((s, i) => (i === 1 ? { ...s, detail: `Packing at ${first?.shipsFrom ?? "the factory"} now. We'll show you a photo of your parcel.`, at: undefined, image: undefined } : i === 0 ? { ...s, at: "Just now" } : { ...s, at: undefined })),
  };
}

/** Where your order is, from factory to door, with Protect holding the money until you're happy. */
export function OrderJourney({ placed }: { placed?: OrderView | null }) {
  const { markets, market: home } = useStore();
  const money = useMoney();
  const [sheet, setSheet] = useState<Detent>("closed");
  const [reported, setReported] = useState<string | null>(null);
  // A placed order from the database, or (for the sample id) the demo shipment.
  const order = placed ? { id: placed.number, total: placed.totals.total, lines: placed.lines.map((l) => ({ ...l, option: l.option ?? undefined })) } : undefined;
  const market = (placed && markets.find((m) => m.code === placed.country)) || home;
  const awaitingPayment = placed?.status === "awaiting_payment";
  const s = order ? fromOrder(order, market.city, market.code, market.extraDays) : demoShipment;
  const progress = s.stage / (s.steps.length - 1);
  const now = s.steps[s.stage];

  return (
    <div className="mx-auto max-w-[760px] px-3.5 pt-safe pb-36 lg:px-6 lg:pt-6 lg:pb-16">
      <header className="flex items-center gap-3 pt-2 pb-4 lg:pt-0">
        <Link href="/me" aria-label="Back" className="glass grid size-11 shrink-0 place-items-center rounded-full">
          <Icon name="back" className="size-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-xl font-bold">Order {s.orderId}</h1>
          <p className="text-xs text-ink-2">
            {s.lines.reduce((n, l) => n + l.qty, 0)} items · {money(s.total)}
          </p>
        </div>
      </header>

      {awaitingPayment && (
        <p role="status" className="mb-4 flex items-start gap-2 rounded-2xl bg-save/12 p-3 text-[13px] text-save ring-1 ring-save/30">
          <Icon name="clock" className="mt-0.5 size-4 shrink-0" />
          <span>
            <b className="font-semibold">Waiting for your payment.</b> The sellers start packing as soon as it lands.
          </span>
        </p>
      )}

      <section aria-label="Delivery" className="glass relative overflow-hidden rounded-[30px] p-5">
        <p className="text-xs font-semibold text-ink-2">Arriving</p>
        <p className="font-display text-[34px] leading-tight font-extrabold tracking-[-0.03em]">{s.eta}</p>
        <p className="mt-1 flex items-center gap-2 text-sm">
          <span className="relative flex size-2.5">
            <span className="absolute inset-0 animate-ping rounded-full bg-positive/70" />
            <span className="relative size-2.5 rounded-full bg-positive" />
          </span>
          <b className="font-semibold">{now.label}</b>
          {s.steps[s.stage + 1] && <span className="truncate text-ink-2">· next: {s.steps[s.stage + 1].label.toLowerCase()}</span>}
        </p>

        <div className="mt-6">
          <div className="flex justify-between text-xs font-semibold">
            <span className="flex items-center gap-1.5">
              <Flag code="CN" className="size-4" />
              {s.from}
            </span>
            <span className="flex items-center gap-1.5">
              {s.to}
              <Flag code={s.toCode} className="size-4" />
            </span>
          </div>
          <div className="relative mt-3 h-10" role="progressbar" aria-label="Journey" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
            <span className="absolute inset-x-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-white/10" />
            <span className="absolute top-1/2 left-0 h-1 -translate-y-1/2 rounded-full bg-gradient-to-r from-accent to-accent-light" style={{ width: `${progress * 100}%` }} />
            {s.steps.map((_, i) => (
              <span
                key={i}
                className={`absolute top-1/2 size-2 -translate-x-1/2 -translate-y-1/2 rounded-full ${i <= s.stage ? "bg-accent-light" : "bg-white/25"}`}
                style={{ left: `${(i / (s.steps.length - 1)) * 100}%` }}
              />
            ))}
            <span className="glass glass-prominent absolute top-1/2 grid size-10 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full" style={{ left: `${progress * 100}%` }}>
              <Icon name={s.mode === "air" ? "plane" : "ship"} className="size-5 rotate-90" />
            </span>
          </div>
          <p className="mt-3 flex items-center justify-between text-xs text-ink-2">
            <span>{s.carrier}</span>
            <span className="font-mono">{s.tracking}</span>
          </p>
        </div>
      </section>

      <section aria-labelledby="steps-h" className="mt-5">
        <h2 id="steps-h" className="mb-3 px-1 text-[15px] font-bold">
          Journey
        </h2>
        <ol className="glass rounded-[26px] px-4 py-2">
          {s.steps.map((step, i) => {
            const state = i < s.stage ? "done" : i === s.stage ? "now" : "next";
            return (
              <li key={step.label} className="relative flex gap-3.5 py-3">
                {i < s.steps.length - 1 && <span aria-hidden="true" className={`absolute top-10 bottom-0 left-[13px] w-0.5 ${i < s.stage ? "bg-positive/50" : "bg-white/10"}`} />}
                <span
                  className={`relative z-10 grid size-7 shrink-0 place-items-center rounded-full ${state === "done" ? "bg-positive/20 text-positive" : state === "now" ? "bg-accent shadow-[0_0_0_5px_rgb(204_58_23/0.25)]" : "bg-white/[0.08] text-ink-3"}`}
                >
                  {state === "done" ? <Icon name="check" className="size-4" /> : state === "now" ? <span className="size-2 rounded-full bg-white" /> : <span className="size-1.5 rounded-full bg-current" />}
                </span>
                <div className="min-w-0 flex-1 pt-0.5">
                  <p className={`flex items-baseline justify-between gap-3 text-[15px] font-semibold ${state === "next" ? "text-ink-3" : ""}`}>
                    {step.label}
                    {step.at && <span className="shrink-0 text-xs font-normal text-ink-3">{step.at}</span>}
                  </p>
                  <p className={`text-[13px] leading-snug ${state === "next" ? "text-ink-3" : "text-ink-2"}`}>{step.detail}</p>
                  {step.image && <Image src={step.image} alt="Your parcel at the factory" width={140} height={140} sizes="140px" className="mt-2 size-[140px] rounded-2xl object-cover" />}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="protect-h" className="glass mt-5 rounded-[26px] p-4">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-positive/15 text-positive">
            <Icon name="shield" />
          </span>
          <div>
            <h2 id="protect-h" className="text-[15px] font-bold">
              {money(s.total)} held by {brand.name} Protect
            </h2>
            <p className="text-[13px] text-ink-2">The seller is paid 3 days after delivery, around {s.protectUntil}, unless you report a problem. Then the money stays put until it&apos;s fixed.</p>
          </div>
        </div>
        {reported ? (
          <p role="status" className="mt-3 rounded-2xl bg-positive/10 p-3 text-[13px]">
            <b className="font-semibold">Case opened: “{reported}”.</b> We&apos;ll reply within 24 hours, and your money stays held until it&apos;s sorted.
          </p>
        ) : (
          <div className="mt-3 flex gap-2">
            <button type="button" onClick={() => setSheet("half")} className="glass-inset h-11 flex-1 rounded-full text-sm font-semibold">
              Report a problem
            </button>
            <Link href="/inbox/voltgrid" className="glass-inset flex h-11 flex-1 items-center justify-center gap-1.5 rounded-full text-sm font-semibold">
              <Icon name="chat" className="size-4" />
              Message seller
            </Link>
          </div>
        )}
      </section>

      <section aria-labelledby="items-h" className="mt-5">
        <h2 id="items-h" className="mb-3 px-1 text-[15px] font-bold">
          In this order
        </h2>
        <ul className="glass flex flex-col divide-y divide-line rounded-[26px] px-4">
          {s.lines.map((l) => {
            const p = getProduct(l.slug);
            return p ? (
              <li key={l.slug}>
                <Link href={`/p/${p.slug}`} className="flex items-center gap-3 py-3">
                  <Image src={p.images[0]} alt="" width={52} height={52} sizes="52px" className="size-[52px] rounded-xl object-cover" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{p.title}</span>
                    <span className="block text-xs text-ink-2">
                      {l.option ? `${l.option} · ` : ""}× {l.qty}
                    </span>
                  </span>
                  <span className="font-display text-sm font-bold">{money(l.unitPrice * l.qty)}</span>
                </Link>
              </li>
            ) : null;
          })}
        </ul>
      </section>

      <Sheet detent={sheet} onDetent={setSheet} label="Report a problem">
        <div className="flex min-h-0 flex-1 flex-col">
          <header className="flex shrink-0 touch-none items-center gap-3 px-4 pt-1 pb-3">
            <h2 className="flex-1 font-display text-[22px] font-bold">What went wrong?</h2>
            <button type="button" onClick={() => setSheet("closed")} aria-label="Close" className="glass-inset grid size-9 place-items-center rounded-full">
              <Icon name="close" className="size-[18px]" />
            </button>
          </header>
          <ul data-sheet-scroll className="pb-safe flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4">
            {problems.map((p) => (
              <li key={p}>
                <button
                  type="button"
                  onClick={() => {
                    setReported(p);
                    setSheet("closed");
                  }}
                  className="glass-inset flex h-14 w-full items-center justify-between rounded-2xl px-4 text-[15px] font-semibold"
                >
                  {p}
                  <Icon name="forward" className="size-4 text-ink-3" />
                </button>
              </li>
            ))}
            <li className="px-1 pt-2 text-xs text-ink-3">Opening a case freezes the payment. Most cases are settled within 3 days.</li>
          </ul>
        </div>
      </Sheet>
    </div>
  );
}
