"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";
import { Icon } from "@/components/icon";
import { useMoney } from "@/components/price";
import type { ShopRfqView } from "@/modules/sourcing";
import { sendQuoteAction, withdrawQuoteAction } from "@/server/actions/sourcing";

type Listing = { slug: string; title: string; image: string; price: number | null };

const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

function state(r: ShopRfqView): [string, string] {
  if (r.mine?.status === "accepted") return ["Accepted", "bg-positive/15 text-positive"];
  if (r.mine?.status === "declined") return ["Not chosen", "bg-white/10 text-ink-2"];
  if (r.status !== "open") return ["Closed", "bg-white/10 text-ink-2"];
  if (r.mine?.status === "offered") return ["Quoted", "bg-series/20 text-series"];
  return ["New", "bg-accent/20 text-accent-light"];
}

/** Requests buyers sent this shop, newest open ones first. */
export function QuoteRequests({ rfqs }: { rfqs: ShopRfqView[] }) {
  if (!rfqs.length) {
    return (
      <p className="glass-inset rounded-[22px] p-5 text-sm text-ink-2">
        No requests yet. When a buyer asks for a bulk price on something you list, or on a listing you sell by quote, it shows up here and we notify you.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-2">
      {rfqs.map((r) => {
        const [label, tone] = state(r);
        return (
          <li key={r.id}>
            <Link href={`/sell/quotes/${r.id}`} className="glass flex items-start gap-3 rounded-[22px] p-4">
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold text-ink-3">
                  {r.code} · {r.incoterm} {r.port}
                </p>
                <p className="truncate text-[15px] font-semibold">
                  {r.qty.toLocaleString("en-US")} × {r.item}
                </p>
                <p className="text-xs text-ink-2">
                  {r.buyerName} · {r.status === "open" ? `open until ${day(r.closesAt)}` : `asked ${day(r.createdAt)}`} · {r.quotes === 0 ? "no quotes yet" : r.quotes === 1 ? "1 quote so far" : `${r.quotes} quotes so far`}
                </p>
              </div>
              <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${tone}`}>{label}</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** One request, and this shop's quote on it. */
export function QuoteDesk({ initial, listings }: { initial: ShopRfqView; listings: Listing[] }) {
  const money = useMoney();
  const [r, setR] = useState(initial);
  const mine = r.mine;
  const editable = r.status === "open" && (!mine || mine.status === "offered" || mine.status === "withdrawn");
  const [form, setForm] = useState({
    slug: mine?.slug ?? (r.slug && listings.some((l) => l.slug === r.slug) ? r.slug : (listings[0]?.slug ?? "")),
    unitPrice: mine ? String(mine.unitPrice) : "",
    moq: String(mine?.moq ?? Math.min(r.qty, 100)),
    leadDays: String(mine?.leadDays ?? 15),
    sample: mine?.sample === null || mine?.sample === undefined ? "" : String(mine.sample),
    note: mine?.note ?? "",
  });
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, start] = useTransition();
  const listing = listings.find((l) => l.slug === form.slug);
  const unit = Number(form.unitPrice) || 0;
  const [label, tone] = state(r);

  return (
    <div className="flex flex-col gap-4">
      <section className="glass rounded-[24px] p-4">
        <div className="flex items-start gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-ink-3">
              {r.code} · from {r.buyerName}
            </p>
            <h2 className="text-lg leading-snug font-semibold">
              {r.qty.toLocaleString("en-US")} × {r.item}
            </h2>
          </div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${tone}`}>{label}</span>
        </div>
        {r.details && <p className="mt-2 text-sm whitespace-pre-line text-ink-2">{r.details}</p>}
        <dl className="mt-3 grid grid-cols-2 gap-1.5 text-[12px] sm:grid-cols-4">
          {[
            ["Deliver to", r.port],
            ["Price includes", r.incoterm === "FOB" ? "FOB: to the port in China" : r.incoterm === "CIF" ? "CIF: freight to their port" : "DDP: to their door, duties paid"],
            ["Target", r.target ? `${money(r.target)} a unit` : "None given"],
            ["Sample", r.samples ? "They'd like one first" : "Not asked"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-xl bg-white/[0.05] px-2.5 py-2">
              <dt className="text-ink-3">{k}</dt>
              <dd className="font-semibold">{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-xs text-ink-3">
          {r.status === "open" ? `Open for quotes until ${day(r.closesAt)}.` : "Closed."} {r.quotes === 0 ? "No shop has quoted yet." : r.quotes === 1 ? "1 shop has quoted." : `${r.quotes} shops have quoted.`} Shoppers see each shop&apos;s quote side by side.
        </p>
      </section>

      {mine?.status === "accepted" && (
        <p className="flex items-start gap-2.5 rounded-[20px] bg-positive/10 p-4 text-sm">
          <Icon name="check" className="mt-0.5 size-5 shrink-0 text-positive" />
          <span>
            <b className="font-semibold">They accepted your quote.</b> {money(mine.unitPrice)} a unit is held for them until {day(mine.holdUntil!)}
            {mine.range ? ` for ${mine.range.min.toLocaleString("en-US")}–${mine.range.max.toLocaleString("en-US")} units` : ""}. {mine.used ? "They've ordered: it's in your orders." : "The order shows up in your orders once they pay."}
          </span>
        </p>
      )}
      {mine?.status === "declined" && <p className="glass-inset rounded-[20px] p-4 text-sm text-ink-2">The buyer went with another shop this time.</p>}

      {editable && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (busy) return;
            setError(null);
            setSent(false);
            start(async () => {
              const res = await sendQuoteAction(r.id, {
                slug: form.slug,
                unitPrice: unit,
                moq: Number(form.moq) || 0,
                leadDays: Number(form.leadDays) || 0,
                sample: form.sample === "" ? null : Number(form.sample),
                note: form.note,
              });
              if (!res.ok) return setError(res.message);
              setR(res.rfq);
              setSent(true);
            });
          }}
          className="glass flex flex-col gap-2 rounded-[24px] p-4"
        >
          <h2 className="text-[15px] font-bold">{mine?.status === "offered" ? "Your quote" : "Send a quote"}</h2>
          {listings.length === 0 ? (
            <p className="text-sm text-ink-2">
              Quotes are for one of your live listings.{" "}
              <Link href="/sell/listings/new" className="font-semibold text-ink underline underline-offset-2">
                Add a listing
              </Link>{" "}
              first.
            </p>
          ) : (
            <>
              <label className="glass-inset relative flex items-center gap-2.5 rounded-2xl p-2 pr-9">
                {listing && <Image src={listing.image} alt="" width={40} height={40} sizes="40px" className="size-10 shrink-0 rounded-xl object-cover" />}
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="text-[11px] font-semibold text-ink-2">Listing they&apos;ll buy</span>
                  <select value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="h-7 min-w-0 appearance-none truncate bg-transparent text-base outline-none">
                    {listings.map((l) => (
                      <option key={l.slug} value={l.slug} className="bg-raised">
                        {l.title}
                        {l.price === null ? " (by quote)" : ` (${money(l.price)})`}
                      </option>
                    ))}
                  </select>
                </span>
                <Icon name="down" className="absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-ink-2" />
              </label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {(
                  [
                    ["unitPrice", "Price per unit, US$", "decimal"],
                    ["moq", "Minimum order", "numeric"],
                    ["leadDays", "Lead time, days", "numeric"],
                    ["sample", "Sample price, US$", "decimal"],
                  ] as const
                ).map(([key, name, mode]) => (
                  <label key={key} className="glass-inset flex flex-col rounded-2xl px-3.5 py-2">
                    <span className="text-[11px] font-semibold text-ink-2">{name}</span>
                    <input
                      inputMode={mode}
                      value={form[key]}
                      placeholder={key === "sample" ? "No sample" : undefined}
                      onChange={(e) => setForm({ ...form, [key]: e.target.value.replace(mode === "numeric" ? /\D/g : /[^\d.]/g, "") })}
                      className="h-7 bg-transparent text-base outline-none placeholder:text-ink-3"
                    />
                  </label>
                ))}
              </div>
              <label className="glass-inset flex flex-col rounded-2xl px-3.5 py-2">
                <span className="text-[11px] font-semibold text-ink-2">Note (optional)</span>
                <textarea value={form.note} maxLength={500} rows={2} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder="Materials, packaging, certificates, what the price includes…" className="resize-none bg-transparent text-base outline-none placeholder:text-ink-3" />
              </label>
              {unit > 0 && (
                <p className="px-1 text-[13px] text-ink-2">
                  {Math.max(r.qty, Number(form.moq) || 0).toLocaleString("en-US")} units come to <b className="text-ink">{money(unit * Math.max(r.qty, Number(form.moq) || 0))}</b>. If they accept, the price is held for them for 7 days and checkout charges it; you&apos;re paid after delivery, like any order.
                </p>
              )}
              {error && (
                <p role="alert" className="text-[13px] text-like">
                  {error}
                </p>
              )}
              {sent && !error && (
                <p role="status" className="text-[13px] text-positive">
                  Sent. The buyer has been told.
                </p>
              )}
              <div className="flex gap-2">
                <button type="submit" disabled={busy || !unit || !form.slug} className="h-12 flex-1 rounded-full bg-accent text-[15px] font-bold disabled:opacity-40">
                  {busy ? "Sending…" : mine?.status === "offered" ? "Update quote" : "Send quote"}
                </button>
                {mine?.status === "offered" && (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() =>
                      start(async () => {
                        const res = await withdrawQuoteAction(r.id);
                        if (res.ok) {
                          setR(res.rfq);
                          setSent(false);
                        } else setError(res.message);
                      })
                    }
                    className="glass-inset h-12 rounded-full px-5 text-sm font-semibold"
                  >
                    Withdraw
                  </button>
                )}
              </div>
            </>
          )}
        </form>
      )}
    </div>
  );
}
