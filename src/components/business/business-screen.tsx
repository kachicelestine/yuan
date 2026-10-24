"use client";

import Image from "next/image";
import Link from "next/link";
import { useId, useState } from "react";
import { Icon, VerifiedBadge } from "@/components/icon";
import { useMoney } from "@/components/price";
import { brand } from "@/config/brand";
import { businessRfqs } from "@/lib/account";
import { getSeller, getSellerProfile, type BusinessRfq } from "@/lib/catalog";
import { useStored } from "@/lib/use-stored";

const ports = ["Apapa, Lagos", "Tema, Ghana", "Mombasa, Kenya", "Durban, South Africa", "Abidjan, Côte d'Ivoire", "Santos, Brazil", "Nhava Sheva, India", "Rotterdam, Netherlands", "Los Angeles, USA", "Jebel Ali, Dubai"];
const terms = [
  { id: "FOB", label: "FOB", detail: "Factory loads it on the ship; you handle freight." },
  { id: "CIF", label: "CIF", detail: "Factory pays freight and insurance to your port." },
  { id: "DDP", label: "DDP", detail: "Delivered to your door, duties paid. Easiest." },
] as const;

/** Business mode: request quotes from several factories at once, compare them, and buy with trade assurance. */
export function BusinessScreen() {
  const id = useId();
  const money = useMoney();
  const [enabled, setEnabled] = useStored<boolean>("app.business", false);
  const [mine, setMine] = useStored<BusinessRfq[]>("app.business-rfqs", []);
  const [accepted, setAccepted] = useStored<Record<string, string>>("app.business-accepted", {});
  const [form, setForm] = useState({ item: "", qty: "500", target: "", port: ports[0], incoterm: "DDP" as BusinessRfq["incoterm"], samples: true });
  const rfqs = [...mine, ...businessRfqs];

  return (
    <div className="mx-auto max-w-[900px] px-3.5 pt-safe pb-36 lg:px-6 lg:pt-6 lg:pb-16">
      <header className="flex items-center gap-3 pt-2 pb-4 lg:pt-0">
        <Link href="/me" aria-label="Back" className="glass grid size-11 shrink-0 place-items-center rounded-full lg:hidden">
          <Icon name="back" className="size-5" />
        </Link>
        <div className="flex-1">
          <h1 className="font-display text-[30px] leading-tight font-extrabold tracking-[-0.03em]">{brand.name} Business</h1>
          <p className="text-xs text-ink-2">Factory prices in bulk, with your money protected until the goods pass inspection.</p>
        </div>
      </header>

      <label className="glass flex cursor-pointer items-center gap-3 rounded-[24px] p-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-series/20 text-series">
          <Icon name="factory" />
        </span>
        <span className="flex-1">
          <b className="block text-[15px] font-semibold">Business pricing</b>
          <span className="text-[13px] text-ink-2">{enabled ? "On: bulk tiers and MOQ shown everywhere." : "Show bulk tiers, MOQ and factory terms everywhere."}</span>
        </span>
        <input type="checkbox" role="switch" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="peer sr-only" />
        <span className="relative h-8 w-[52px] shrink-0 rounded-full bg-white/20 transition-colors peer-checked:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-white">
          <span className={`absolute top-1 left-1 size-6 rounded-full bg-white shadow transition-transform duration-500 ease-spring ${enabled ? "translate-x-5" : ""}`} />
        </span>
      </label>

      <ul className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["shield", "Trade assurance", "Paid only after inspection"],
          ["users", "One request, many quotes", "Factories compete for you"],
          ["gift", "Samples first", "Test before you commit"],
          ["eye", "Pre-shipment inspection", "Photos and a report"],
        ].map(([icon, title, detail]) => (
          <li key={title} className="glass-inset rounded-[20px] p-3">
            <Icon name={icon as "shield"} className="size-5 text-positive" />
            <p className="mt-2 text-[13px] leading-tight font-semibold">{title}</p>
            <p className="text-[11px] text-ink-3">{detail}</p>
          </li>
        ))}
      </ul>

      <section aria-labelledby={`${id}-new`} className="glass mt-5 rounded-[26px] p-4">
        <h2 id={`${id}-new`} className="text-[15px] font-bold">
          Request quotes
        </h2>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.item.trim()) return;
            setMine([{ id: `RFQ-${120 + mine.length}`, item: form.item.trim(), qty: Number(form.qty) || 100, port: form.port, incoterm: form.incoterm, status: "quoting", quotes: [] }, ...mine]);
            setForm({ ...form, item: "", target: "" });
          }}
          className="mt-3 grid gap-2 sm:grid-cols-2"
        >
          <label className="glass-inset flex flex-col rounded-2xl px-3.5 py-2 sm:col-span-2">
            <span className="text-[11px] font-semibold text-ink-2">What do you need?</span>
            <input value={form.item} onChange={(e) => setForm({ ...form, item: e.target.value })} placeholder="e.g. 450 W solar panels, all black frames" className="h-7 bg-transparent text-base outline-none placeholder:text-ink-3" />
          </label>
          <label className="glass-inset flex flex-col rounded-2xl px-3.5 py-2">
            <span className="text-[11px] font-semibold text-ink-2">Quantity</span>
            <input inputMode="numeric" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value.replace(/\D/g, "") })} className="h-7 bg-transparent text-base outline-none" />
          </label>
          <label className="glass-inset flex flex-col rounded-2xl px-3.5 py-2">
            <span className="text-[11px] font-semibold text-ink-2">Target unit price (optional)</span>
            <input inputMode="decimal" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} placeholder="Let factories bid" className="h-7 bg-transparent text-base outline-none placeholder:text-ink-3" />
          </label>
          <label className="glass-inset relative flex flex-col rounded-2xl px-3.5 py-2 sm:col-span-2">
            <span className="text-[11px] font-semibold text-ink-2">Destination port</span>
            <select value={form.port} onChange={(e) => setForm({ ...form, port: e.target.value })} className="h-7 appearance-none bg-transparent text-base outline-none">
              {ports.map((p) => (
                <option key={p} className="bg-raised">
                  {p}
                </option>
              ))}
            </select>
            <Icon name="down" className="absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-ink-2" />
          </label>
          <fieldset className="sm:col-span-2">
            <legend className="mb-2 text-[11px] font-semibold text-ink-2">Delivery terms</legend>
            <div className="grid grid-cols-3 gap-2">
              {terms.map((t) => (
                <label key={t.id} className={`cursor-pointer rounded-2xl p-3 transition-[background,box-shadow] has-focus-visible:ring-2 has-focus-visible:ring-white ${form.incoterm === t.id ? "bg-white/15 shadow-[inset_0_0_0_1.5px_#fff]" : "glass-inset"}`}>
                  <input type="radio" name="incoterm" checked={form.incoterm === t.id} onChange={() => setForm({ ...form, incoterm: t.id })} className="sr-only" />
                  <b className="block text-sm font-bold">{t.label}</b>
                  <span className="text-[11px] leading-tight text-ink-2">{t.detail}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <label className="flex cursor-pointer items-center gap-3 sm:col-span-2">
            <input type="checkbox" checked={form.samples} onChange={(e) => setForm({ ...form, samples: e.target.checked })} className="size-5 accent-white" />
            <span className="text-[13px] text-ink-2">Ask for samples before mass production</span>
          </label>
          <button type="submit" disabled={!form.item.trim()} className="mt-1 h-12 rounded-full bg-accent text-[15px] font-bold disabled:opacity-40 sm:col-span-2">
            Send to matching factories
          </button>
        </form>
      </section>

      <section aria-labelledby={`${id}-list`} className="mt-5 flex flex-col gap-3">
        <h2 id={`${id}-list`} className="px-1 text-[15px] font-bold">
          Your requests
        </h2>
        {rfqs.map((r) => {
          const pick = accepted[r.id];
          const best = r.quotes.length ? r.quotes.reduce((b, q, i) => (q.unitPrice < r.quotes[b].unitPrice ? i : b), 0) : -1;
          const fastest = r.quotes.length ? r.quotes.reduce((b, q, i) => (q.leadDays < r.quotes[b].leadDays ? i : b), 0) : -1;
          return (
            <article key={r.id} className="glass rounded-[26px] p-4">
              <header className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-semibold text-ink-3">
                    {r.id} · {r.incoterm} {r.port}
                  </p>
                  <h3 className="text-[15px] font-semibold">
                    {r.qty.toLocaleString("en-US")} × {r.item}
                  </h3>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${pick ? "bg-positive/15 text-positive" : "bg-save/15 text-save"}`}>
                  {pick ? "Ordered" : r.quotes.length ? `${r.quotes.length} quotes` : "Quoting…"}
                </span>
              </header>
              {r.quotes.length === 0 ? (
                <p className="mt-3 flex items-center gap-2 text-[13px] text-ink-2">
                  <span className="size-2 animate-blink rounded-full bg-save" />
                  Sent to matching audited factories. First quotes usually arrive within 6 hours.
                </p>
              ) : (
                <ul className="mt-3 flex flex-col gap-2">
                  {r.quotes.map((q, i) => {
                    const s = getSeller(q.sellerId);
                    const profile = getSellerProfile(q.sellerId);
                    const chosen = pick === q.sellerId;
                    return (
                      <li key={q.sellerId} className={`rounded-[20px] p-3 ${chosen ? "bg-positive/10 ring-1 ring-positive/40" : "glass-inset"}`}>
                        <div className="flex items-center gap-2.5">
                          {s && <Image src={s.avatar} alt="" width={36} height={36} sizes="36px" className="size-9 rounded-xl object-cover" />}
                          <div className="min-w-0 flex-1">
                            <p className="flex items-center gap-1 text-sm font-semibold">
                              <span className="truncate">{s?.name}</span>
                              {s?.verified && <VerifiedBadge className="size-3.5" />}
                            </p>
                            <p className="text-[11px] text-ink-2">
                              ★ {profile?.rating} · replies in {profile?.responseHours} h
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-display text-lg leading-tight font-extrabold">{money(q.unitPrice)}</p>
                            <p className="text-[10.5px] text-ink-3">per unit</p>
                          </div>
                        </div>
                        <dl className="mt-2.5 grid grid-cols-3 gap-1.5 text-center text-[11px]">
                          {[
                            ["Total", money(q.unitPrice * r.qty)],
                            ["Lead time", `${q.leadDays} days`],
                            ["Sample", money(q.sample)],
                          ].map(([k, v]) => (
                            <div key={k} className="rounded-xl bg-white/[0.05] py-1.5">
                              <dt className="text-ink-3">{k}</dt>
                              <dd className="font-semibold">{v}</dd>
                            </div>
                          ))}
                        </dl>
                        <p className="mt-2 text-xs text-ink-2">{q.note}</p>
                        <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                          {i === best && <span className="rounded-full bg-positive/15 px-2 py-0.5 text-[10.5px] font-bold text-positive">Lowest price</span>}
                          {i === fastest && <span className="rounded-full bg-series/20 px-2 py-0.5 text-[10.5px] font-bold text-series">Fastest</span>}
                          <span className="text-[10.5px] text-ink-3">MOQ {q.moq.toLocaleString("en-US")}</span>
                          {!pick && (
                            <button type="button" onClick={() => setAccepted({ ...accepted, [r.id]: q.sellerId })} className="ml-auto h-9 rounded-full bg-white px-4 text-xs font-bold text-black">
                              Accept quote
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              {pick && (
                <p className="mt-3 flex items-start gap-2.5 rounded-2xl bg-positive/10 p-3 text-[13px]">
                  <Icon name="shield" className="mt-0.5 size-5 shrink-0 text-positive" />
                  <span>
                    <b className="font-semibold">Trade assurance is on.</b> Your payment is held until an inspector checks the goods at the factory. We&apos;ll send photos and a report before anything ships.
                  </span>
                </p>
              )}
            </article>
          );
        })}
      </section>
    </div>
  );
}
