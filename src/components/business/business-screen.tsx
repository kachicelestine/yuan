"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, useTransition } from "react";
import { Icon, VerifiedBadge } from "@/components/icon";
import { useMoney } from "@/components/price";
import { useStore } from "@/components/providers";
import { brand } from "@/config/brand";
import { cartKey } from "@/modules/ordering";
import { plural } from "@/lib/format";
import type { RfqView } from "@/modules/sourcing";
import { acceptQuoteAction, closeRfqAction } from "@/server/actions/sourcing";
import { RfqForm } from "./rfq-form";

export type ShopInfo = { name: string; avatar: string; verified: boolean; rating: number; responseHours: number | null };
export type ListingInfo = { title: string; image: string };

const day = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });

/** Business: ask several shops for a bulk price at once, compare the quotes, and buy at the one you pick. */
export function BusinessScreen({ signedIn, rfqs: initial, shops, listings }: { signedIn: boolean; rfqs: RfqView[]; shops: Record<string, ShopInfo>; listings: Record<string, ListingInfo> }) {
  const id = useId();
  const [rfqs, setRfqs] = useState(initial);
  const replace = (r: RfqView) => setRfqs((list) => list.map((x) => (x.id === r.id ? r : x)));

  return (
    <div className="mx-auto max-w-[900px] px-3.5 pt-safe pb-36 lg:px-6 lg:pt-6 lg:pb-16">
      <header className="flex items-center gap-3 pt-2 pb-4 lg:pt-0">
        <Link href="/me" aria-label="Back" className="glass grid size-11 shrink-0 place-items-center rounded-full lg:hidden">
          <Icon name="back" className="size-5" />
        </Link>
        <div className="flex-1">
          <h1 className="font-display text-[30px] leading-tight font-extrabold tracking-[-0.03em]">{brand.name} Business</h1>
          <p className="text-xs text-ink-2">Ask shops for a bulk price, compare their quotes, and buy at the one you pick.</p>
        </div>
      </header>

      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {[
          ["users", "One request, many quotes", "Sent to up to 8 shops that sell it"],
          ["clock", "Price held 7 days", "Accept, then check out at that price"],
          ["gift", "Samples first", "Shops can quote a sample price"],
          ["shield", "Protect", "Paid to the shop after delivery"],
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
        <RfqForm signedIn={signedIn} next="/business" onSent={(r) => setRfqs((list) => [r, ...list])} />
      </section>

      <section aria-labelledby={`${id}-list`} className="mt-5 flex flex-col gap-3">
        <h2 id={`${id}-list`} className="px-1 text-[15px] font-bold">
          Your requests
        </h2>
        {rfqs.length === 0 && <p className="px-1 text-sm text-ink-2">{signedIn ? "Nothing yet. Ask for a bulk price above and quotes land here." : "Sign in to request quotes and see them here."}</p>}
        {rfqs.map((r) => (
          <RfqCard key={r.id} rfq={r} shops={shops} listings={listings} onChange={replace} />
        ))}
      </section>
    </div>
  );
}

function RfqCard({ rfq: r, shops, listings, onChange }: { rfq: RfqView; shops: Record<string, ShopInfo>; listings: Record<string, ListingInfo>; onChange: (r: RfqView) => void }) {
  const money = useMoney();
  const router = useRouter();
  const { cart, addToCart, setQty } = useStore();
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const live = r.quotes.filter((q) => q.status === "offered" || q.status === "accepted");
  const accepted = r.quotes.find((q) => q.status === "accepted");
  const best = live.length > 1 ? live.reduce((b, q) => (q.unitPrice < b.unitPrice ? q : b)).id : null;
  const fastest = live.length > 1 ? live.reduce((b, q) => (q.leadDays < b.leadDays ? q : b)).id : null;
  const chip = r.status === "ordered" ? ["Accepted", "bg-positive/15 text-positive"] : r.status === "closed" ? ["Closed", "bg-white/10 text-ink-2"] : live.length ? [plural(live.length, "quote"), "bg-save/15 text-save"] : ["Waiting", "bg-save/15 text-save"];

  const accept = (quoteId: string) =>
    start(async () => {
      setError(null);
      const res = await acceptQuoteAction(quoteId);
      if (!res.ok) return setError(res.message);
      onChange(res.rfq);
      const key = cartKey({ slug: res.line.slug, option: null });
      if (cart.some((l) => l.key === key)) setQty(key, res.line.qty);
      else addToCart({ slug: res.line.slug, title: res.line.title, image: res.line.image, option: undefined, unitPrice: res.line.unitPrice, qty: res.line.qty, note: `Quote ${r.code}` });
      router.push("/checkout");
    });

  return (
    <article id={`rfq-${r.id}`} className="glass scroll-mt-20 rounded-[26px] p-4">
      <header className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold text-ink-3">
            {r.code} · {r.incoterm} {r.port}
          </p>
          <h3 className="text-[15px] font-semibold">
            {r.qty.toLocaleString("en-US")} × {r.item}
          </h3>
          {r.details && <p className="mt-0.5 line-clamp-2 text-xs text-ink-2">{r.details}</p>}
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${chip[1]}`}>{chip[0]}</span>
      </header>

      {live.length === 0 ? (
        <p className="mt-3 flex items-center gap-2 text-[13px] text-ink-2">
          {r.status === "open" && <span className="size-2 animate-blink rounded-full bg-save" />}
          {r.status === "open" ? `Sent to ${plural(r.shops, "shop")} that sell this. Open until ${day(r.closesAt)}.` : "No quotes came in."}
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {live.map((q) => {
            const s = shops[q.sellerId];
            const listing = listings[q.slug];
            const chosen = q.status === "accepted";
            const units = Math.max(r.qty, q.moq);
            return (
              <li key={q.id} className={`rounded-[20px] p-3 ${chosen ? "bg-positive/10 ring-1 ring-positive/40" : "glass-inset"}`}>
                <div className="flex items-center gap-2.5">
                  {s?.avatar && <Image src={s.avatar} alt="" width={36} height={36} sizes="36px" className="size-9 rounded-xl object-cover" />}
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1 text-sm font-semibold">
                      <span className="truncate">{s?.name ?? q.sellerId}</span>
                      {s?.verified && <VerifiedBadge className="size-3.5" />}
                    </p>
                    <p className="text-[11px] text-ink-2">
                      {s?.rating ? `★ ${s.rating.toFixed(1)}` : "New shop"}
                      {s?.responseHours ? ` · replies in ${s.responseHours} h` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-lg leading-tight font-extrabold">{money(q.unitPrice)}</p>
                    <p className="text-[10.5px] text-ink-3">per unit</p>
                  </div>
                </div>
                {listing && (
                  <Link href={`/p/${q.slug}`} className="mt-2.5 flex items-center gap-2 rounded-xl bg-white/[0.05] p-1.5 pr-3">
                    <Image src={listing.image} alt="" width={32} height={32} sizes="32px" className="size-8 rounded-lg object-cover" />
                    <span className="min-w-0 flex-1 truncate text-xs font-semibold">{listing.title}</span>
                    <Icon name="forward" className="size-3.5 text-ink-3" />
                  </Link>
                )}
                <dl className="mt-2 grid grid-cols-3 gap-1.5 text-center text-[11px]">
                  {[
                    [`For ${units.toLocaleString("en-US")}`, money(q.unitPrice * units)],
                    ["Lead time", `${q.leadDays} days`],
                    ["Sample", q.sample === null ? "None" : q.sample === 0 ? "Free" : money(q.sample)],
                  ].map(([k, v]) => (
                    <div key={k} className="rounded-xl bg-white/[0.05] py-1.5">
                      <dt className="text-ink-3">{k}</dt>
                      <dd className="font-semibold">{v}</dd>
                    </div>
                  ))}
                </dl>
                {q.note && <p className="mt-2 text-xs text-ink-2">{q.note}</p>}
                <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                  {q.id === best && <span className="rounded-full bg-positive/15 px-2 py-0.5 text-[10.5px] font-bold text-positive">Lowest price</span>}
                  {q.id === fastest && <span className="rounded-full bg-series/20 px-2 py-0.5 text-[10.5px] font-bold text-series">Fastest</span>}
                  <span className="text-[10.5px] text-ink-3">Min. order {q.moq.toLocaleString("en-US")}</span>
                  {r.status === "open" && (
                    <button type="button" disabled={busy} onClick={() => accept(q.id)} className="ml-auto h-9 rounded-full bg-white px-4 text-xs font-bold text-black disabled:opacity-50">
                      {busy ? "Accepting…" : "Accept and check out"}
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {accepted?.range && (
        <p className="mt-3 flex items-start gap-2.5 rounded-2xl bg-positive/10 p-3 text-[13px]">
          <Icon name="shield" className="mt-0.5 size-5 shrink-0 text-positive" />
          <span>
            {accepted.used ? (
              <>
                <b className="font-semibold">Ordered at the quoted price.</b> Protect holds your payment until you confirm delivery.
              </>
            ) : (
              <>
                <b className="font-semibold">
                  {money(accepted.unitPrice)} a unit is yours until {day(accepted.holdUntil!)}
                </b>{" "}
                for {accepted.range.min.toLocaleString("en-US")}–{accepted.range.max.toLocaleString("en-US")} units.{" "}
                <Link href="/checkout" className="font-semibold underline underline-offset-2">
                  Check out
                </Link>
              </>
            )}
          </span>
        </p>
      )}
      {error && (
        <p role="alert" className="mt-2 text-[13px] text-like">
          {error}
        </p>
      )}
      {r.status === "open" && (
        <button
          type="button"
          disabled={busy}
          onClick={() =>
            start(async () => {
              const res = await closeRfqAction(r.id);
              if (res.ok) onChange(res.rfq);
              else setError(res.message);
            })
          }
          className="mt-2 h-9 text-[13px] font-semibold text-ink-2"
        >
          Close request
        </button>
      )}
    </article>
  );
}
