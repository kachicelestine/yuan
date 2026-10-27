"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Kind = "amount" | "percent" | "free_shipping";
export type CouponFormInput = { kind: Kind; value: number; minSpend: number; title: string; detail: string; days: number };
type Result = { ok: true; id: string } | { ok: false; message: string };

const KINDS: { id: Kind; label: string }[] = [
  { id: "amount", label: "$ off" },
  { id: "percent", label: "% off" },
  { id: "free_shipping", label: "Free shipping" },
];

/** Issue a coupon: platform-wide from the admin panel, or a shop's own voucher. */
export function CouponForm({ action, scope }: { action: (input: CouponFormInput) => Promise<Result>; scope: "platform" | "shop" }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<Kind>("amount");
  const [value, setValue] = useState("5");
  const [minSpend, setMinSpend] = useState("30");
  const [days, setDays] = useState("14");
  const [title, setTitle] = useState("");
  const [detail, setDetail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const n = (s: string) => Number(s.replace(/[^0-9.]/g, "")) || 0;
  const suggested = kind === "amount" ? `$${n(value)} off` : kind === "percent" ? `${n(value)}% off` : "Free shipping";

  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="mb-4 h-11 w-full rounded-full bg-accent text-sm font-bold text-white">
        {scope === "shop" ? "New shop voucher" : "Issue a coupon"}
      </button>
    );

  const field = "glass-inset h-11 w-full rounded-2xl px-3.5 text-sm outline-none placeholder:text-ink-3";
  return (
    <form
      className="glass mb-4 flex flex-col gap-3 rounded-[24px] p-4"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const r = await action({ kind, value: kind === "percent" ? n(value) / 100 : n(value), minSpend: n(minSpend), title: title.trim() || suggested, detail, days: Math.round(n(days)) });
          if (!r.ok) return setError(r.message);
          setOpen(false);
          setTitle("");
          setDetail("");
          router.refresh();
        });
      }}
    >
      <div role="radiogroup" aria-label="Kind" className="grid grid-cols-3 gap-1.5">
        {KINDS.map((k) => (
          <button key={k.id} type="button" role="radio" aria-checked={kind === k.id} onClick={() => setKind(k.id)} className={`h-9 rounded-full text-xs font-semibold ${kind === k.id ? "bg-white/15 text-ink" : "glass-inset text-ink-2"}`}>
            {k.label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2">
        {kind !== "free_shipping" && (
          <label className="flex flex-col gap-1 text-[11px] font-semibold text-ink-2">
            {kind === "amount" ? "Dollars off" : "Percent off"}
            <input inputMode="decimal" value={value} onChange={(e) => setValue(e.target.value)} className={field} />
          </label>
        )}
        <label className="flex flex-col gap-1 text-[11px] font-semibold text-ink-2">
          Min. spend ($)
          <input inputMode="decimal" value={minSpend} onChange={(e) => setMinSpend(e.target.value)} className={field} />
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-semibold text-ink-2">
          Runs (days)
          <input inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} className={field} />
        </label>
      </div>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={suggested} aria-label="Title" maxLength={40} className={field} />
      <input value={detail} onChange={(e) => setDetail(e.target.value)} placeholder={scope === "shop" ? "e.g. On everything in the shop" : "e.g. Your first order"} aria-label="Detail" maxLength={120} className={field} />
      {error && (
        <p role="alert" className="text-sm text-like">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={pending} className="h-11 flex-1 rounded-full bg-accent text-sm font-bold text-white disabled:opacity-50">
          {pending ? "Issuing…" : "Issue"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="h-11 rounded-full px-4 text-sm font-semibold text-ink-2">
          Cancel
        </button>
      </div>
    </form>
  );
}
