"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useNow } from "@/lib/use-now";
import type { DepositKind, SellerDepositOfferView } from "@/modules/engagement";
import { cancelDepositOfferAction, createDepositOfferAction } from "@/server/actions/deposits";

type Listing = { slug: string; title: string; image: string; price: number | null };

const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short" });
const field = "glass-inset h-11 rounded-2xl px-3 text-[15px] font-normal text-ink outline-none";
const label = "flex flex-col gap-1 text-xs font-semibold text-ink-2";
const pad = (n: number) => String(n).padStart(2, "0");
/** Suggested amounts for a price: a ~5% deposit (at least $1) counting for up to 3 times itself, never past half the price. */
const suggest = (price: number | null) => {
  const deposit = Math.max(1, Math.round((price ?? 20) * 0.05));
  return { deposit: String(deposit), credit: String(Math.min(deposit * 3, Math.floor((price ?? 20) / 2))) };
};
const local = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** A shop's pre-orders and 11.11 pre-sales: a deposit now, the balance later. */
export function DepositOffersManager({ offers, listings, owner }: { offers: SellerDepositOfferView[]; listings: Listing[]; owner: boolean }) {
  const router = useRouter();
  const now = useNow(60_000);
  const priced = listings.filter((l) => l.price !== null);
  const info = new Map(listings.map((l) => [l.slug, l]));
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState<DepositKind>("presale");
  const [slug, setSlug] = useState(priced[0]?.slug ?? "");
  const [title, setTitle] = useState("");
  const [blurb, setBlurb] = useState("");
  const [deposit, setDeposit] = useState(() => suggest(priced[0]?.price ?? null).deposit);
  const [credit, setCredit] = useState(() => suggest(priced[0]?.price ?? null).credit);
  const [price, setPrice] = useState(String(priced[0]?.price ?? ""));
  const [closes, setCloses] = useState(() => local(new Date(Date.now() + 7 * 86_400_000)));
  const [ships, setShips] = useState(() => local(new Date(Date.now() + 30 * 86_400_000)));
  const [days, setDays] = useState("7");
  const [stock, setStock] = useState("100");
  const [perPerson, setPerPerson] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const balance = (Number(price) || 0) - (kind === "presale" ? Number(credit) || 0 : Number(deposit) || 0);

  function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await createDepositOfferAction({
        slug,
        kind,
        title,
        blurb,
        deposit: Number(deposit),
        credit: Number(credit),
        price: Number(price),
        opensAt: new Date().toISOString(),
        closesAt: new Date(closes).toISOString(),
        balanceFrom: kind === "preorder" ? new Date(ships).toISOString() : null,
        balanceDays: Number(days) || 7,
        stock: Number(stock),
        perPerson: Number(perPerson),
      });
      if (!r.ok) return setError(r.message);
      setAdding(false);
      setTitle("");
      setBlurb("");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {offers.length === 0 && !adding && <p className="glass-inset rounded-[22px] p-4 text-sm text-ink-2">No pre-orders yet. Take deposits on something that ships later, or run an 11.11 pre-sale where a small deposit counts for more on the day.</p>}
      <ul className="flex flex-col gap-2">
        {offers.map((o) => {
          const l = info.get(o.slug);
          return (
            <li key={o.id} className="glass flex items-center gap-3 rounded-[22px] p-3">
              {l && <Image src={l.image} alt="" width={48} height={48} sizes="48px" className="size-12 rounded-xl object-cover" />}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{o.title}</p>
                <p className="text-xs text-ink-2">
                  {o.kind === "presale" ? "Pre-sale" : "Pre-order"} · {usd(o.deposit)} deposit counts as {usd(o.credit)} · balance {day(o.balanceFrom)}–{day(o.balanceUntil)}
                </p>
                <p className="text-xs text-ink-3">
                  {o.cancelled ? "Cancelled, deposits refunded" : `${o.paid + o.converted} paid of ${o.stock} · ${o.converted} balances paid`}
                </p>
              </div>
              {owner && !o.cancelled && now !== null && now < Date.parse(o.balanceFrom) && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    start(async () => {
                      const r = await cancelDepositOfferAction(o.id);
                      if (!r.ok) setError(r.message);
                      router.refresh();
                    })
                  }
                  className="glass-inset h-9 shrink-0 rounded-full px-3.5 text-xs font-semibold"
                >
                  Cancel
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {error && !adding && (
        <p role="alert" className="text-[13px] text-like">
          {error}
        </p>
      )}
      {owner && !adding && priced.length > 0 && (
        <button type="button" onClick={() => setAdding(true)} className="glass-inset h-11 rounded-full text-sm font-semibold">
          New pre-order or pre-sale
        </button>
      )}
      {adding && (
        <form onSubmit={create} className="glass grid gap-2.5 rounded-[24px] p-4 sm:grid-cols-2">
          <div role="radiogroup" aria-label="Kind" className="glass-inset flex rounded-full p-1 sm:col-span-2">
            {(["presale", "preorder"] as const).map((k) => (
              <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={`h-9 flex-1 rounded-full text-[13px] font-bold ${kind === k ? "bg-white text-black" : "text-ink-2"}`}>
                {k === "presale" ? "11.11 pre-sale" : "Pre-order"}
              </button>
            ))}
          </div>
          <label className={`${label} sm:col-span-2`}>
            Listing
            <select
              value={slug}
              onChange={(e) => {
                setSlug(e.target.value);
                const p = info.get(e.target.value)?.price ?? null;
                setPrice(String(p ?? ""));
                setDeposit(suggest(p).deposit);
                setCredit(suggest(p).credit);
              }}
              className={field}
            >
              {priced.map((l) => (
                <option key={l.slug} value={l.slug} className="bg-raised">
                  {l.title} ({usd(l.price!)})
                </option>
              ))}
            </select>
          </label>
          <label className={`${label} sm:col-span-2`}>
            Title
            <input value={title} maxLength={80} onChange={(e) => setTitle(e.target.value)} placeholder={kind === "presale" ? "11.11 pre-sale: …" : "2027 batch, ships in December"} className={field} />
          </label>
          <label className={`${label} sm:col-span-2`}>
            One line for buyers (optional)
            <input value={blurb} maxLength={200} onChange={(e) => setBlurb(e.target.value)} className={field} />
          </label>
          <label className={label}>
            Full price, US$
            <input inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d.]/g, ""))} className={field} />
          </label>
          <label className={label}>
            Deposit, US$
            <input inputMode="decimal" value={deposit} onChange={(e) => setDeposit(e.target.value.replace(/[^\d.]/g, ""))} className={field} />
          </label>
          {kind === "presale" && (
            <label className={label}>
              Counts as on 11.11, US$
              <input inputMode="decimal" value={credit} onChange={(e) => setCredit(e.target.value.replace(/[^\d.]/g, ""))} className={field} />
            </label>
          )}
          <label className={label}>
            Deposits close
            <input type="datetime-local" value={closes} onChange={(e) => setCloses(e.target.value)} className={field} />
          </label>
          {kind === "preorder" && (
            <>
              <label className={label}>
                Ships (balance opens)
                <input type="datetime-local" value={ships} onChange={(e) => setShips(e.target.value)} className={field} />
              </label>
              <label className={label}>
                Days to pay the balance
                <input inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, ""))} className={field} />
              </label>
            </>
          )}
          <label className={label}>
            How many
            <input inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value.replace(/\D/g, ""))} className={field} />
          </label>
          <label className={label}>
            Per person
            <input inputMode="numeric" value={perPerson} onChange={(e) => setPerPerson(e.target.value.replace(/\D/g, ""))} className={field} />
          </label>
          <p className="text-[12px] leading-snug text-ink-2 sm:col-span-2">
            Buyers pay {usd(Number(deposit) || 0)} now and {usd(Math.max(0, balance))} {kind === "presale" ? "on 11.11 (Beijing time)" : "when the balance opens"}
            {kind === "presale" && Number(credit) > Number(deposit) ? `, so you fund ${usd(Number(credit) - Number(deposit))} of each discount` : ""}. You get the deposit when the order is delivered, or if the buyer lets the balance window pass. Cancelling refunds every deposit.
          </p>
          {error && (
            <p role="alert" className="text-[13px] text-like sm:col-span-2">
              {error}
            </p>
          )}
          <div className="flex gap-2 sm:col-span-2">
            <button type="submit" disabled={busy || !title.trim()} className="h-11 flex-1 rounded-full bg-accent text-sm font-bold disabled:opacity-50">
              {busy ? "Saving…" : "Start taking deposits"}
            </button>
            <button type="button" onClick={() => setAdding(false)} className="glass-inset h-11 rounded-full px-5 text-sm font-semibold">
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
