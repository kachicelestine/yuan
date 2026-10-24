"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { DisputeView } from "@/modules/ordering";
import type { DisbursementView } from "@/modules/payments";
import { cancelPayoutAction, markSentAction, resolveDisputeAction } from "@/server/actions/admin";

const REASONS: Record<string, string> = {
  not_arrived: "Hasn't arrived",
  damaged: "Arrived damaged",
  not_as_described: "Not as described",
  wrong_item: "Wrong item or size",
  other: "Something else",
};
const usd = (n: number) => `$${n.toFixed(2)}`;
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

/** Buyer disputes: refund the buyer or pay the shop, with a note both sides see. */
export function Disputes({ list }: { list: DisputeView[] }) {
  const router = useRouter();
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const key = (d: DisputeView) => `${d.orderId}:${d.sellerId}`;

  async function decide(d: DisputeView, outcome: "refund" | "release") {
    setBusy(key(d));
    setError(null);
    const r = await resolveDisputeAction(d.orderId, d.sellerId, outcome, notes[key(d)] ?? "");
    setBusy(null);
    if (!r.ok) return setError(r.message);
    router.refresh();
  }

  if (!list.length) return <p className="glass-inset rounded-[22px] p-4 text-sm text-ink-2">No open disputes.</p>;
  return (
    <ul className="flex flex-col gap-2.5">
      {error && (
        <li role="alert" className="text-sm text-like">
          {error}
        </li>
      )}
      {list.map((d) => (
        <li key={key(d)} className="glass flex flex-col gap-2 rounded-[22px] p-4">
          <p className="flex items-center justify-between gap-2 text-xs text-ink-2">
            <span>
              <b className="font-mono text-ink">{d.orderNumber}</b> · {d.sellerId} · to {d.country}
            </span>
            <span className="font-display text-sm font-bold text-ink">{usd(d.amount)}</span>
          </p>
          <p className="text-sm">
            <b>{REASONS[d.dispute?.reason ?? "other"]}</b>
            {d.dispute?.openedAt && <span className="text-ink-2"> · opened {day(d.dispute.openedAt)}</span>}
          </p>
          {d.dispute?.note && <p className="text-sm text-ink-2 italic">“{d.dispute.note}”</p>}
          <p className="text-xs text-ink-2">
            {d.tracking ? (
              <>
                {d.carrier} <span className="font-mono">{d.tracking}</span> · shipped {d.shippedAt && day(d.shippedAt)}
              </>
            ) : (
              "Never shipped"
            )}
          </p>
          <ul className="flex flex-col gap-1">
            {d.lines.map((l, i) => (
              <li key={i} className="flex items-center gap-2 text-xs">
                <Image src={l.image} alt="" width={28} height={28} sizes="28px" className="size-7 rounded-md object-cover" />
                <span className="truncate">
                  {l.qty} × {l.title}
                </span>
              </li>
            ))}
          </ul>
          <textarea
            aria-label="Decision note"
            value={notes[key(d)] ?? ""}
            onChange={(e) => setNotes((n) => ({ ...n, [key(d)]: e.target.value }))}
            rows={2}
            placeholder="The reason, in a sentence. Buyer and shop both see it."
            className="glass-inset rounded-2xl p-3 text-sm outline-none"
          />
          <div className="flex gap-2">
            <button type="button" disabled={busy === key(d) || (notes[key(d)] ?? "").trim().length < 5} onClick={() => decide(d, "refund")} className="h-10 flex-1 rounded-full bg-like/15 text-sm font-bold text-like disabled:opacity-40">
              Refund buyer
            </button>
            <button type="button" disabled={busy === key(d) || (notes[key(d)] ?? "").trim().length < 5} onClick={() => decide(d, "release")} className="h-10 flex-1 rounded-full bg-positive/20 text-sm font-bold text-positive disabled:opacity-40">
              Pay the shop
            </button>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Payouts and refunds waiting to be sent from the treasury wallet. */
export function SendMoney({ list, explorer }: { list: DisbursementView[]; explorer: string }) {
  const router = useRouter();
  const [tx, setTx] = useState<Record<string, string>>({});
  const [addr, setAddr] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function sent(d: DisbursementView) {
    setBusy(d.id);
    setError(null);
    const r = await markSentAction(d.id, tx[d.id] ?? "", d.address ?? addr[d.id] ?? null);
    setBusy(null);
    if (!r.ok) return setError(r.message);
    router.refresh();
  }

  const [cancelling, setCancelling] = useState<Record<string, string>>({});

  async function cancel(d: DisbursementView) {
    setBusy(d.id);
    setError(null);
    const r = await cancelPayoutAction(d.id, cancelling[d.id] ?? "");
    setBusy(null);
    if (!r.ok) return setError(r.message);
    router.refresh();
  }

  if (!list.length) return <p className="glass-inset rounded-[22px] p-4 text-sm text-ink-2">Nothing to send.</p>;
  return (
    <ul className="flex flex-col gap-2.5">
      {error && (
        <li role="alert" className="text-sm text-like">
          {error}
        </li>
      )}
      <li className="px-1 text-xs text-ink-3">Send USDC on Base from the treasury wallet, then paste the transaction hash. Nothing moves until you do.</li>
      {list.map((d) => (
        <li key={d.id} className="glass flex flex-col gap-2 rounded-[22px] p-4">
          <p className="flex items-center justify-between gap-2 text-sm">
            <span>
              <b className="font-semibold">{d.kind === "payout" ? "Payout" : d.kind === "creator" ? "Creator payout" : "Refund"}</b> · {d.sellerId ?? `creator ${d.accountId?.slice(0, 8)}`} · {day(d.requestedAt)}
            </span>
            <span className="font-display text-base font-bold">{usd(d.amount)}</span>
          </p>
          {d.address ? (
            <p className="font-mono text-xs break-all text-ink-2">To {d.address}</p>
          ) : (
            <>
              <p className="text-xs text-ink-2">
                Refund to the wallet that paid
                {d.paymentTx && (
                  <>
                    {" "}
                    (
                    <a href={`${explorer}/tx/${d.paymentTx}`} target="_blank" rel="noreferrer" className="text-agent">
                      see the payment
                    </a>
                    )
                  </>
                )}
                .
              </p>
              <input aria-label="Refund address" value={addr[d.id] ?? ""} onChange={(e) => setAddr((a) => ({ ...a, [d.id]: e.target.value.trim() }))} placeholder="0x… address it was sent to" className="glass-inset h-10 rounded-2xl px-3 font-mono text-xs outline-none" />
            </>
          )}
          <input aria-label="Transaction hash" value={tx[d.id] ?? ""} onChange={(e) => setTx((t) => ({ ...t, [d.id]: e.target.value.trim() }))} placeholder="0x… transaction hash" className="glass-inset h-10 rounded-2xl px-3 font-mono text-xs outline-none" />
          <div className="flex gap-2">
            <button type="button" disabled={busy === d.id || (tx[d.id] ?? "").length < 66} onClick={() => sent(d)} className="h-10 flex-1 rounded-full bg-accent text-sm font-bold disabled:opacity-40">
              Mark as sent
            </button>
            {d.kind !== "refund" && !(d.id in cancelling) && (
              <button type="button" disabled={busy === d.id} onClick={() => setCancelling((c) => ({ ...c, [d.id]: "" }))} className="h-10 rounded-full px-4 text-sm font-semibold text-ink-2">
                Cancel
              </button>
            )}
          </div>
          {d.id in cancelling && (
            <div className="flex gap-2">
              <input aria-label="Why it's cancelled" value={cancelling[d.id]} onChange={(e) => setCancelling((c) => ({ ...c, [d.id]: e.target.value }))} placeholder="Why? The shop sees this." className="glass-inset h-10 min-w-0 flex-1 rounded-2xl px-3 text-sm outline-none" />
              <button type="button" disabled={busy === d.id || cancelling[d.id].trim().length < 5} onClick={() => cancel(d)} className="h-10 shrink-0 rounded-full bg-like/15 px-4 text-sm font-bold text-like disabled:opacity-40">
                Cancel payout
              </button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
