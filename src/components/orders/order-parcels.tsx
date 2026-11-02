"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/icon";
import { useMoney } from "@/components/price";
import { Sheet, type Detent } from "@/components/sheet";
import { brand } from "@/config/brand";
import { trackingLink } from "@/modules/delivery";
import type { OrderView, ShipmentView } from "@/modules/ordering";
import { confirmReceivedAction, openDisputeAction, postReviewAction } from "@/server/actions/orders";

const REASONS: { id: string; label: string }[] = [
  { id: "not_arrived", label: "It hasn't arrived" },
  { id: "damaged", label: "It arrived damaged" },
  { id: "not_as_described", label: "It's not as described" },
  { id: "wrong_item", label: "Wrong item or size" },
  { id: "other", label: "Something else" },
];

const STATUS: Record<ShipmentView["status"], { label: string; tone: string }> = {
  awaiting_shipment: { label: "Packing", tone: "bg-white/10 text-ink-2" },
  shipped: { label: "On its way", tone: "bg-agent/15 text-agent" },
  delivered: { label: "Delivered", tone: "bg-positive/15 text-positive" },
  disputed: { label: "Problem reported", tone: "bg-save/15 text-save" },
  refunded: { label: "Refunded", tone: "bg-white/10 text-ink-2" },
};

const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

type Props = {
  order: OrderView;
  parcels: ShipmentView[];
  shops: Record<string, { name: string; avatar: string }>;
  /** Products already reviewed in this order. */
  reviewed: string[];
};

/** Each shop's parcel: where it is, confirming it arrived, reporting a problem, and reviews once delivered. */
export function OrderParcels({ order, parcels, shops, reviewed }: Props) {
  const router = useRouter();
  const money = useMoney();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [problem, setProblem] = useState<{ sellerId: string; reason: string | null } | null>(null);
  const [note, setNote] = useState("");
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [done, setDone] = useState<string[]>(reviewed);

  async function run(key: string, work: () => Promise<{ ok: true } | { ok: false; message: string }>) {
    setBusy(key);
    setError(null);
    const r = await work();
    setBusy(null);
    if (!r.ok) {
      setError(r.message);
      return false;
    }
    router.refresh();
    return true;
  }

  async function report() {
    if (!problem?.reason) return;
    if (await run("dispute", () => openDisputeAction(order.id, problem.sellerId, problem.reason!, note.trim() || null))) {
      setProblem(null);
      setNote("");
    }
  }

  return (
    <section aria-labelledby="parcels-h" className="mt-5">
      <h2 id="parcels-h" className="mb-3 px-1 text-[15px] font-bold">
        {parcels.length > 1 ? `${parcels.length} parcels, one from each shop` : "Your parcel"}
      </h2>
      {order.address && (
        <p className="mb-3 px-1 text-[13px] text-ink-2">
          To {order.address.name}, {order.address.line1}
          {order.address.line2 && `, ${order.address.line2}`}, {[order.address.city, order.address.region, order.address.postcode].filter(Boolean).join(", ")} · {order.address.phone}
        </p>
      )}
      {error && (
        <p role="alert" className="mb-2 px-1 text-sm text-like">
          {error}
        </p>
      )}
      <ul className="flex flex-col gap-3">
        {parcels.map((p) => {
          const shop = shops[p.sellerId];
          const lines = order.lines.filter((l) => l.sellerId === p.sellerId);
          return (
            <li key={p.sellerId} className="glass rounded-[26px] p-4">
              <header className="flex items-center gap-2.5">
                {shop && <Image src={shop.avatar} alt="" width={32} height={32} sizes="32px" className="size-8 rounded-lg object-cover" />}
                <Link href={`/s/${p.sellerId}`} className="min-w-0 flex-1 truncate text-sm font-semibold">
                  {shop?.name ?? p.sellerId}
                </Link>
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS[p.status].tone}`}>{STATUS[p.status].label}</span>
                <Link href={`/inbox/${p.sellerId}?about=${lines[0]?.slug ?? ""}`} aria-label={`Message ${shop?.name ?? "the shop"}`} className="glass-inset grid size-9 shrink-0 place-items-center rounded-full">
                  <Icon name="chat" className="size-4" />
                </Link>
              </header>

              {p.tracking && (
                <p className="mt-2 flex items-center justify-between gap-2 text-xs text-ink-2">
                  <span>
                    {p.carrier} · shipped {p.shippedAt && day(p.shippedAt)}
                  </span>
                  <a href={trackingLink(p.carrier ?? "", p.tracking)} target="_blank" rel="noopener noreferrer" className="font-mono text-ink underline decoration-white/30 underline-offset-2">
                    {p.tracking}
                  </a>
                </p>
              )}
              {p.status === "awaiting_shipment" && <p className="mt-2 text-xs text-ink-2">The shop is packing it. You&apos;ll get the tracking number here.</p>}
              {p.status === "shipped" && p.autoConfirmAt && (
                <p className="mt-2 text-xs text-ink-2">
                  {brand.name} Protect holds {money(p.amount)} until you confirm, or until {day(p.autoConfirmAt)} if you don&apos;t.
                </p>
              )}
              {p.dispute && p.status === "disputed" && (
                <p className="mt-2 rounded-2xl bg-save/10 p-3 text-xs text-ink-2">
                  <b className="text-ink">{REASONS.find((r) => r.id === p.dispute!.reason)?.label}.</b> We&apos;re looking into it; the money stays held until it&apos;s settled.
                </p>
              )}
              {p.resolution && (
                <p className="mt-2 rounded-2xl bg-white/[0.06] p-3 text-xs text-ink-2">
                  <b className="text-ink">{p.resolution.outcome === "refund" ? "Refunded" : "Paid to the shop"}:</b> {p.resolution.note}
                </p>
              )}

              <ul className="mt-3 flex flex-col gap-2">
                {lines.map((l) => (
                  <li key={l.slug + (l.option ?? "")} className="flex flex-col gap-2">
                    <div className="flex items-center gap-3">
                      <Image src={l.image} alt="" width={44} height={44} sizes="44px" className="size-11 rounded-xl object-cover" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{l.title}</span>
                        <span className="text-xs text-ink-2">
                          {l.option ? `${l.option} · ` : ""}× {l.qty} · {money(l.unitPrice * l.qty)}
                        </span>
                      </span>
                      {p.status === "delivered" &&
                        (done.includes(l.slug) ? (
                          <span className="text-xs font-semibold text-positive">Reviewed</span>
                        ) : (
                          <button type="button" onClick={() => setReviewing(reviewing === l.slug ? null : l.slug)} className="glass-inset h-8 shrink-0 rounded-full px-3 text-xs font-semibold">
                            Review
                          </button>
                        ))}
                    </div>
                    {reviewing === l.slug && (
                      <ReviewForm
                        busy={busy === `review:${l.slug}`}
                        onSend={async (rating, text) => {
                          if (await run(`review:${l.slug}`, () => postReviewAction(order.id, l.slug, rating, text))) {
                            setDone((d) => [...d, l.slug]);
                            setReviewing(null);
                          }
                        }}
                      />
                    )}
                  </li>
                ))}
              </ul>

              {(p.status === "shipped" || p.status === "awaiting_shipment") && (
                <div className="mt-3 flex gap-2">
                  {p.status === "shipped" && (
                    <button type="button" disabled={busy !== null} onClick={() => run(`confirm:${p.sellerId}`, () => confirmReceivedAction(order.id, p.sellerId))} className="h-11 flex-1 rounded-full bg-accent text-sm font-bold disabled:opacity-50">
                      {busy === `confirm:${p.sellerId}` ? "Confirming…" : "I got it"}
                    </button>
                  )}
                  <button type="button" disabled={busy !== null} onClick={() => setProblem({ sellerId: p.sellerId, reason: null })} className="glass-inset h-11 flex-1 rounded-full text-sm font-semibold disabled:opacity-50">
                    Report a problem
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <Sheet detent={problem ? "half" : "closed"} onDetent={(d: Detent) => d === "closed" && setProblem(null)} label="Report a problem">
        <div className="flex min-h-0 flex-1 flex-col">
          <header className="flex shrink-0 touch-none items-center gap-3 px-4 pt-1 pb-3">
            <h2 className="flex-1 font-display text-[22px] font-bold">What went wrong?</h2>
            <button type="button" onClick={() => setProblem(null)} aria-label="Close" className="glass-inset grid size-9 place-items-center rounded-full">
              <Icon name="close" className="size-[18px]" />
            </button>
          </header>
          <div data-sheet-scroll className="pb-safe flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto px-4">
            {REASONS.map((r) => (
              <button
                key={r.id}
                type="button"
                aria-pressed={problem?.reason === r.id}
                onClick={() => setProblem((p) => p && { ...p, reason: r.id })}
                className={`flex h-14 w-full items-center justify-between rounded-2xl px-4 text-[15px] font-semibold ${problem?.reason === r.id ? "bg-white text-black" : "glass-inset"}`}
              >
                {r.label}
                {problem?.reason === r.id && <Icon name="check" className="size-4" />}
              </button>
            ))}
            {problem?.reason && (
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={1000} placeholder="What happened? Photos help: add them in a message to the shop." className="glass-inset rounded-2xl p-3 text-base outline-none" />
            )}
            <button type="button" disabled={!problem?.reason || busy !== null} onClick={report} className="mt-1 h-12 rounded-full bg-accent text-[15px] font-bold disabled:opacity-40">
              {busy === "dispute" ? "Opening a case…" : "Open a case"}
            </button>
            <p className="px-1 pt-1 text-xs text-ink-3">Opening a case keeps the payment held. Most cases are settled within 3 days.</p>
          </div>
        </div>
      </Sheet>
    </section>
  );
}

function ReviewForm({ busy, onSend }: { busy: boolean; onSend: (rating: number, text: string) => void }) {
  const [rating, setRating] = useState(0);
  const [text, setText] = useState("");
  return (
    <div className="glass-inset flex flex-col gap-2 rounded-2xl p-3">
      <div role="radiogroup" aria-label="Rating" className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" role="radio" aria-checked={rating === n} aria-label={`${n} stars`} onClick={() => setRating(n)} className="p-0.5">
            <Icon name="star" filled={n <= rating} className={`size-7 ${n <= rating ? "text-save" : "text-ink-3"}`} />
          </button>
        ))}
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} maxLength={2000} placeholder="How is it? Fit, quality, how it compares to the photos." className="rounded-xl bg-transparent text-base outline-none placeholder:text-ink-3" />
      <button type="button" disabled={!rating || text.trim().length < 10 || busy} onClick={() => onSend(rating, text)} className="h-10 self-start rounded-full bg-white px-5 text-sm font-bold text-black disabled:opacity-40">
        {busy ? "Posting…" : "Post review"}
      </button>
    </div>
  );
}
