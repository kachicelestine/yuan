"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Icon } from "@/components/icon";
import type { SampleOfferView, SampleRequestView } from "@/modules/affiliates";
import { createSampleOfferAction, declineSampleAction, setSampleOfferActiveAction, shipSampleAction } from "@/server/actions/shop";

type Listing = { slug: string; title: string; image: string; price: number | null };

const STATUS: Record<SampleRequestView["status"], string> = { requested: "Waiting for you", shipped: "Shipped", declined: "Declined", posted: "Video posted", lapsed: "No video posted" };
const field = "glass-inset h-10 min-w-0 rounded-xl px-3 text-sm outline-none";

/** Free samples for creators: what the shop offers, and the requests to ship or decline. */
export function SamplesManager({ offers, requests, listings, owner }: { offers: SampleOfferView[]; requests: SampleRequestView[]; listings: Listing[]; owner: boolean }) {
  const router = useRouter();
  const info = new Map(listings.map((l) => [l.slug, l]));
  const [adding, setAdding] = useState(false);
  const [slug, setSlug] = useState(listings[0]?.slug ?? "");
  const [quantity, setQuantity] = useState("10");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const run = (work: () => Promise<{ ok: true } | { ok: false; message: string }>, after?: () => void) =>
    start(async () => {
      const r = await work();
      if (!r.ok) return setError(r.message);
      setError(null);
      after?.();
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-3">
      {requests.length > 0 && (
        <ul className="flex flex-col gap-2">
          {requests.map((r) => (
            <li key={r.id}>
              <SampleRequestCard request={r} title={info.get(r.slug)?.title ?? r.slug} owner={owner} onShip={(carrier, tracking) => run(() => shipSampleAction(r.id, carrier, tracking))} onDecline={(reason) => run(() => declineSampleAction(r.id, reason))} busy={busy} />
            </li>
          ))}
        </ul>
      )}

      {offers.map((o) => {
        const l = info.get(o.slug);
        return (
          <section key={o.id} aria-label={l?.title ?? o.slug} className="glass flex items-center gap-3 rounded-[22px] p-3">
            {l && <Image src={l.image} alt="" width={48} height={48} sizes="48px" className="size-12 shrink-0 rounded-xl object-cover" />}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{l?.title ?? o.slug}</span>
              <span className="block text-xs text-ink-2">{o.remaining} samples left</span>
            </span>
            {owner && (
              <button
                type="button"
                role="switch"
                aria-checked={o.active}
                aria-label={o.active ? "Stop offering" : "Offer again"}
                disabled={busy}
                onClick={() => run(() => setSampleOfferActiveAction(o.id, !o.active))}
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
              run(
                () => createSampleOfferAction(slug, Number(quantity)),
                () => setAdding(false),
              );
            }}
            className="glass flex flex-col gap-3 rounded-[22px] p-4"
          >
            <p className="text-[15px] font-bold">Offer free samples</p>
            <div className="grid grid-cols-[1fr_96px] gap-2">
              <select aria-label="Listing" value={slug} onChange={(e) => setSlug(e.target.value)} className={field}>
                {listings.map((l) => (
                  <option key={l.slug} value={l.slug}>
                    {l.title}
                  </option>
                ))}
              </select>
              <input aria-label="How many" value={quantity} onChange={(e) => setQuantity(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" className={field} />
            </div>
            <p className="text-xs text-ink-3">Creators ask with their address; you ship (or decline) each one. They agree to post a video within 21 days of shipping.</p>
            <div className="flex gap-2">
              <button type="submit" disabled={busy || !slug} className="h-11 flex-1 rounded-full bg-accent text-sm font-bold disabled:opacity-40">
                Offer samples
              </button>
              <button type="button" onClick={() => setAdding(false)} className="glass-inset h-11 rounded-full px-5 text-sm font-semibold">
                Cancel
              </button>
            </div>
          </form>
        ) : listings.length ? (
          <button type="button" onClick={() => setAdding(true)} className="glass-inset flex h-12 items-center justify-center gap-2 rounded-full text-sm font-bold">
            <Icon name="gift" className="size-4" />
            Offer free samples
          </button>
        ) : null)}
      {error && (
        <p role="alert" className="text-xs font-semibold text-like">
          {error}
        </p>
      )}
    </div>
  );
}

function SampleRequestCard({ request: r, title, owner, onShip, onDecline, busy }: { request: SampleRequestView; title: string; owner: boolean; onShip: (carrier: string, tracking: string) => void; onDecline: (reason: string) => void; busy: boolean }) {
  const [mode, setMode] = useState<"ship" | "decline" | null>(null);
  const [carrier, setCarrier] = useState("");
  const [tracking, setTracking] = useState("");
  const [reason, setReason] = useState("");
  const a = r.address;
  return (
    <article className="glass flex flex-col gap-2 rounded-[22px] p-4 text-sm">
      <p className="flex items-center justify-between gap-2">
        <b className="min-w-0 truncate font-semibold">{title}</b>
        <span className={`shrink-0 text-xs font-semibold ${r.status === "requested" ? "text-save" : "text-ink-2"}`}>{STATUS[r.status]}</span>
      </p>
      <p className="text-xs text-ink-2">
        For <b className="text-ink">{r.creatorName}</b> · {new Date(r.requestedAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
        {r.note && <> · “{r.note}”</>}
      </p>
      {a && r.status === "requested" && (
        <p className="glass-inset rounded-xl px-3 py-2 text-xs whitespace-pre-line text-ink-2">{[a.name, a.line1, a.line2, [a.city, a.region, a.postcode].filter(Boolean).join(", "), a.country].filter(Boolean).join("\n")}</p>
      )}
      {r.tracking && (
        <p className="text-xs text-ink-2">
          {r.carrier} {r.tracking}
          {r.lapsesAt && ` · video due by ${new Date(r.lapsesAt).toLocaleDateString(undefined, { day: "numeric", month: "short" })}`}
        </p>
      )}
      {owner && r.status === "requested" && mode === null && (
        <div className="flex gap-2">
          <button type="button" onClick={() => setMode("ship")} className="h-10 flex-1 rounded-full bg-white text-[13px] font-bold text-black">
            Mark shipped
          </button>
          <button type="button" onClick={() => setMode("decline")} className="glass-inset h-10 rounded-full px-4 text-[13px] font-semibold">
            Decline
          </button>
        </div>
      )}
      {mode === "ship" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onShip(carrier, tracking);
          }}
          className="flex flex-col gap-2"
        >
          <div className="grid grid-cols-[110px_1fr] gap-2">
            <input aria-label="Carrier" placeholder="Carrier" value={carrier} onChange={(e) => setCarrier(e.target.value)} className={field} />
            <input aria-label="Tracking number" placeholder="Tracking number" value={tracking} onChange={(e) => setTracking(e.target.value)} className={`${field} font-mono uppercase`} />
          </div>
          <button type="submit" disabled={busy} className="h-10 rounded-full bg-accent text-[13px] font-bold disabled:opacity-50">
            Send tracking to the creator
          </button>
        </form>
      )}
      {mode === "decline" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onDecline(reason);
          }}
          className="flex gap-2"
        >
          <input aria-label="Why" placeholder="Why (the creator sees this)" value={reason} onChange={(e) => setReason(e.target.value)} className={`${field} flex-1`} />
          <button type="submit" disabled={busy} className="glass-inset h-10 rounded-full px-4 text-[13px] font-semibold">
            Decline
          </button>
        </form>
      )}
    </article>
  );
}
