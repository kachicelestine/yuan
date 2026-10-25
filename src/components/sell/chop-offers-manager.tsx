"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Icon } from "@/components/icon";
import type { ChopOfferView } from "@/modules/engagement";
import { createChopOfferAction, setChopOfferActiveAction } from "@/server/actions/chops";

type Listing = { slug: string; title: string; image: string; price: number | null };

const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** A shop's chop offers: let shoppers and their friends chop a listing down to a set price. */
export function ChopOffersManager({ offers, listings, owner }: { offers: ChopOfferView[]; listings: Listing[]; owner: boolean }) {
  const router = useRouter();
  const priced = listings.filter((l) => l.price !== null);
  const [adding, setAdding] = useState(false);
  const [slug, setSlug] = useState(priced[0]?.slug ?? "");
  const [target, setTarget] = useState("");
  const [cuts, setCuts] = useState(5);
  const [hours, setHours] = useState(24);
  const [stock, setStock] = useState("20");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const info = new Map(listings.map((l) => [l.slug, l]));
  const picked = info.get(slug);

  const create = () =>
    start(async () => {
      const r = await createChopOfferAction({ slug, target: Number(target), cuts, hours, stock: Number(stock) });
      if (!r.ok) return setError(r.message);
      setError(null);
      setAdding(false);
      setTarget("");
      router.refresh();
    });
  const toggle = (o: ChopOfferView) =>
    start(async () => {
      const r = await setChopOfferActiveAction(o.id, !o.active);
      if (!r.ok) return setError(r.message);
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-3">
      {offers.map((o) => {
        const l = info.get(o.slug);
        return (
          <section key={o.id} aria-label={l?.title ?? o.slug} className="glass flex items-center gap-3 rounded-[22px] p-3">
            {l && <Image src={l.image} alt="" width={48} height={48} sizes="48px" className="size-12 shrink-0 rounded-xl object-cover" />}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{l?.title ?? o.slug}</span>
              <span className="block text-xs text-ink-2">
                {usd(o.fullPrice)} → {usd(o.target)} · {o.cuts} cuts · {o.hours} h
              </span>
              <span className="block text-xs text-ink-2">
                {o.started ?? 0} started · {o.done ?? 0} chopped · {o.remaining} left
              </span>
            </span>
            {owner && (
              <button
                type="button"
                role="switch"
                aria-checked={o.active}
                aria-label={o.active ? "Stop offering" : "Offer again"}
                disabled={busy}
                onClick={() => toggle(o)}
                className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${o.active ? "bg-positive" : "bg-white/20"}`}
              >
                <span className={`absolute top-1 size-5 rounded-full bg-white transition-[left] ${o.active ? "left-6" : "left-1"}`} />
              </button>
            )}
          </section>
        );
      })}

      {owner &&
        (adding ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              create();
            }}
            className="glass flex flex-col gap-3 rounded-[22px] p-4"
          >
            <p className="text-[15px] font-bold">New chop offer</p>
            <label className="flex flex-col gap-1 text-xs font-semibold text-ink-2">
              Listing
              <select value={slug} onChange={(e) => setSlug(e.target.value)} className="glass-inset h-11 rounded-2xl px-3 text-[15px] font-normal text-ink outline-none">
                {priced.map((l) => (
                  <option key={l.slug} value={l.slug}>
                    {l.title} ({usd(l.price!)})
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1 text-xs font-semibold text-ink-2">
                Chopped price
                <span className="glass-inset flex h-11 items-center rounded-2xl px-3">
                  <span className="text-ink-3">$</span>
                  <input value={target} onChange={(e) => setTarget(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" placeholder={picked?.price ? (picked.price * 0.6).toFixed(2) : ""} className="h-full min-w-0 flex-1 bg-transparent pl-1 text-[15px] font-normal text-ink outline-none" />
                </span>
              </label>
              <label className="flex flex-col gap-1 text-xs font-semibold text-ink-2">
                How many to offer
                <input value={stock} onChange={(e) => setStock(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" className="glass-inset h-11 rounded-2xl px-3 text-[15px] font-normal text-ink outline-none" />
              </label>
            </div>
            <fieldset className="flex flex-col gap-1.5">
              <legend className="mb-1 text-xs font-semibold text-ink-2">Cuts needed</legend>
              <div className="flex gap-1.5">
                {[3, 5, 8, 10].map((n) => (
                  <button key={n} type="button" aria-pressed={cuts === n} onClick={() => setCuts(n)} className={`h-9 flex-1 rounded-full text-[13px] font-semibold ${cuts === n ? "bg-white text-black" : "glass-inset text-ink-2"}`}>
                    {n}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset className="flex flex-col gap-1.5">
              <legend className="mb-1 text-xs font-semibold text-ink-2">Time to finish</legend>
              <div className="flex gap-1.5">
                {[12, 24, 48].map((h) => (
                  <button key={h} type="button" aria-pressed={hours === h} onClick={() => setHours(h)} className={`h-9 flex-1 rounded-full text-[13px] font-semibold ${hours === h ? "bg-white text-black" : "glass-inset text-ink-2"}`}>
                    {h} h
                  </button>
                ))}
              </div>
            </fieldset>
            <p className="text-xs text-ink-3">You fund the difference. Each shopper who reaches the target can buy one at that price within 48 hours; unfinished chops cost you nothing.</p>
            {error && (
              <p role="alert" className="text-xs font-semibold text-like">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <button type="submit" disabled={busy || !slug || !Number(target)} className="h-11 flex-1 rounded-full bg-accent text-sm font-bold disabled:opacity-40">
                Offer it
              </button>
              <button type="button" onClick={() => setAdding(false)} className="glass-inset h-11 rounded-full px-5 text-sm font-semibold">
                Cancel
              </button>
            </div>
          </form>
        ) : priced.length ? (
          <button type="button" onClick={() => setAdding(true)} className="glass-inset flex h-12 items-center justify-center gap-2 rounded-full text-sm font-bold">
            <Icon name="scissors" className="size-4" />
            New chop offer
          </button>
        ) : (
          <p className="glass-inset rounded-[22px] p-4 text-sm text-ink-2">Publish a priced listing first; then shoppers can chop it with friends.</p>
        ))}
    </div>
  );
}
