"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Icon } from "@/components/icon";
import type { RfqView } from "@/modules/sourcing";
import { openRfqAction } from "@/server/actions/sourcing";

export const PORTS = ["Apapa, Lagos", "Tema, Ghana", "Mombasa, Kenya", "Durban, South Africa", "Abidjan, Côte d'Ivoire", "Santos, Brazil", "Nhava Sheva, India", "Rotterdam, Netherlands", "Los Angeles, USA", "Jebel Ali, Dubai"];
export const TERMS = [
  { id: "FOB", label: "FOB", detail: "Price at the port in China; you arrange freight." },
  { id: "CIF", label: "CIF", detail: "Price includes freight and insurance to your port." },
  { id: "DDP", label: "DDP", detail: "Price includes delivery to your door, duties paid." },
] as const;
export type Term = (typeof TERMS)[number]["id"];

/** The request form, on the Business page or for one listing (`slug`) from its product page. */
export function RfqForm({ signedIn, next, slug = null, item: fixedItem, onSent }: { signedIn: boolean; next: string; slug?: string | null; item?: string; onSent: (r: RfqView) => void }) {
  const [form, setForm] = useState({ item: "", details: "", qty: slug ? "1" : "500", target: "", port: PORTS[0], incoterm: "DDP" as Term, samples: !slug });
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const item = fixedItem ?? form.item;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!item.trim() || busy) return;
        setError(null);
        start(async () => {
          const r = await openRfqAction({ item, details: form.details, slug, qty: Number(form.qty) || 0, target: form.target ? Number(form.target) || null : null, port: form.port, incoterm: form.incoterm, samples: form.samples });
          if (!r.ok) return setError(r.message);
          onSent(r.rfq);
          setForm((f) => ({ ...f, item: "", details: "", target: "" }));
        });
      }}
      className="mt-3 grid gap-2 sm:grid-cols-2"
    >
      {fixedItem === undefined && (
        <label className="glass-inset flex flex-col rounded-2xl px-3.5 py-2 sm:col-span-2">
          <span className="text-[11px] font-semibold text-ink-2">What do you need?</span>
          <input value={form.item} maxLength={200} onChange={(e) => setForm({ ...form, item: e.target.value })} placeholder="e.g. 450 W solar panels" className="h-7 bg-transparent text-base outline-none placeholder:text-ink-3" />
        </label>
      )}
      <label className="glass-inset flex flex-col rounded-2xl px-3.5 py-2">
        <span className="text-[11px] font-semibold text-ink-2">Quantity</span>
        <input inputMode="numeric" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value.replace(/\D/g, "").slice(0, 5) })} className="h-7 bg-transparent text-base outline-none" />
      </label>
      <label className="glass-inset flex flex-col rounded-2xl px-3.5 py-2">
        <span className="text-[11px] font-semibold text-ink-2">Target price per unit, US$ (optional)</span>
        <input inputMode="decimal" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value.replace(/[^\d.]/g, "") })} placeholder="Let shops bid" className="h-7 bg-transparent text-base outline-none placeholder:text-ink-3" />
      </label>
      <label className="glass-inset relative flex flex-col rounded-2xl px-3.5 py-2 sm:col-span-2">
        <span className="text-[11px] font-semibold text-ink-2">Destination</span>
        <select value={form.port} onChange={(e) => setForm({ ...form, port: e.target.value })} className="h-7 appearance-none bg-transparent text-base outline-none">
          {PORTS.map((p) => (
            <option key={p} className="bg-raised">
              {p}
            </option>
          ))}
        </select>
        <Icon name="down" className="absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-ink-2" />
      </label>
      <fieldset className="sm:col-span-2">
        <legend className="mb-2 text-[11px] font-semibold text-ink-2">What the price should include</legend>
        <div className="grid grid-cols-3 gap-2">
          {TERMS.map((t) => (
            <label key={t.id} className={`cursor-pointer rounded-2xl p-3 transition-[background,box-shadow] has-focus-visible:ring-2 has-focus-visible:ring-white ${form.incoterm === t.id ? "bg-white/15 shadow-[inset_0_0_0_1.5px_#fff]" : "glass-inset"}`}>
              <input type="radio" name={`incoterm-${slug ?? "any"}`} checked={form.incoterm === t.id} onChange={() => setForm({ ...form, incoterm: t.id })} className="sr-only" />
              <b className="block text-sm font-bold">{t.label}</b>
              <span className="mt-0.5 block text-[11px] leading-tight text-ink-2">{t.detail}</span>
            </label>
          ))}
        </div>
      </fieldset>
      <label className="glass-inset flex flex-col rounded-2xl px-3.5 py-2 sm:col-span-2">
        <span className="text-[11px] font-semibold text-ink-2">Details (optional)</span>
        <textarea value={form.details} maxLength={1000} rows={2} onChange={(e) => setForm({ ...form, details: e.target.value })} placeholder="Colours, packaging, your logo, certificates…" className="resize-none bg-transparent text-base outline-none placeholder:text-ink-3" />
      </label>
      <label className="flex cursor-pointer items-center gap-3 sm:col-span-2">
        <input type="checkbox" checked={form.samples} onChange={(e) => setForm({ ...form, samples: e.target.checked })} className="size-5 accent-white" />
        <span className="text-[13px] text-ink-2">I&apos;d like a sample first</span>
      </label>
      {error && (
        <p role="alert" className="text-[13px] text-like sm:col-span-2">
          {error}
        </p>
      )}
      {signedIn ? (
        <button type="submit" disabled={!item.trim() || busy} className="mt-1 h-12 rounded-full bg-accent text-[15px] font-bold disabled:opacity-40 sm:col-span-2">
          {busy ? "Sending…" : slug ? "Send to the shop" : "Send to matching shops"}
        </button>
      ) : (
        <Link href={`/signin?next=${encodeURIComponent(next)}`} className="mt-1 grid h-12 place-items-center rounded-full bg-accent text-[15px] font-bold sm:col-span-2">
          Sign in to request quotes
        </Link>
      )}
    </form>
  );
}
