"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/icon";
import { brand } from "@/config/brand";
import type { DisbursementView } from "@/modules/payments";
import { requestPayoutAction } from "@/server/actions/shop";

export type ShopMoney = {
  /** Withdrawable now, in dollars. */
  available: number;
  /** Held by Protect for parcels not yet confirmed, after commission. */
  inProtect: number;
  commission: number;
  payouts: DisbursementView[];
  wallet: string | null;
  /** Block explorer for transaction receipts (mainnet or testnet). */
  explorer: string;
};

const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const STATUS = { requested: "On its way", sent: "Sent", cancelled: "Cancelled" } as const;

/** What the shop has earned, what's still held, and withdrawals to its wallet. */
export function SellerMoney({ money }: { money: ShopMoney }) {
  const router = useRouter();
  const [amount, setAmount] = useState(money.available >= 20 ? money.available.toFixed(2) : "");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  async function withdraw() {
    setBusy(true);
    setMessage(null);
    const r = await requestPayoutAction(Number(amount));
    setBusy(false);
    if (!r.ok) return setMessage({ tone: "error", text: r.message });
    setMessage({ tone: "ok", text: "Requested. It usually reaches your wallet within a working day." });
    router.refresh();
  }

  return (
    <section aria-label="Money" className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-2.5">
        <div className="glass rounded-[22px] p-4">
          <p className="text-xs font-semibold text-ink-2">Available</p>
          <p className="font-display text-[28px] leading-tight font-extrabold">{usd(money.available)}</p>
        </div>
        <div className="glass-inset rounded-[22px] p-4">
          <p className="text-xs font-semibold text-ink-2">Held by Protect</p>
          <p className="font-display text-[28px] leading-tight font-extrabold text-ink-2">{usd(money.inProtect)}</p>
        </div>
      </div>
      <p className="px-1 text-xs text-ink-3">
        Each parcel is paid to you when the buyer confirms it arrived (or 21 days after you ship it), less {Math.round(money.commission * 1000) / 10}% {brand.name} commission.
      </p>

      <div className="glass flex flex-col gap-2.5 rounded-[22px] p-4">
        <p className="text-[15px] font-bold">Withdraw to your wallet</p>
        <p className="text-xs break-all text-ink-2">USDC on Base to {money.wallet ?? "your payout wallet (missing — contact support)"}</p>
        <div className="flex gap-2">
          <label className="glass-inset flex h-12 min-w-0 flex-1 items-center rounded-2xl px-4">
            <span className="text-ink-3">$</span>
            <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" aria-label="Amount" className="h-full min-w-0 flex-1 bg-transparent pl-1 text-base outline-none" />
          </label>
          <button type="button" disabled={busy || !(Number(amount) >= 20) || Number(amount) > money.available} onClick={withdraw} className="h-12 shrink-0 rounded-full bg-accent px-5 text-sm font-bold disabled:opacity-40">
            {busy ? "Requesting…" : "Withdraw"}
          </button>
        </div>
        <p className="text-xs text-ink-3">From $20. No fee from us; the network fee is under a cent.</p>
        {message && (
          <p role={message.tone === "error" ? "alert" : "status"} className={`text-sm ${message.tone === "error" ? "text-like" : "text-positive"}`}>
            {message.text}
          </p>
        )}
      </div>

      {money.payouts.length > 0 && (
        <ul className="glass flex flex-col divide-y divide-line overflow-hidden rounded-[22px]">
          {money.payouts.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-4 py-3 text-sm">
              <Icon name={p.status === "sent" ? "check" : p.status === "cancelled" ? "close" : "clock"} className={`size-5 ${p.status === "sent" ? "text-positive" : "text-ink-2"}`} />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{usd(p.amount)}</span>
                <span className="block text-xs text-ink-2">
                  {STATUS[p.status]} · {new Date(p.requestedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  {p.note && ` · ${p.note}`}
                </span>
              </span>
              {p.txHash && (
                <a href={`${money.explorer}/tx/${p.txHash}`} target="_blank" rel="noreferrer" className="text-xs font-semibold text-agent">
                  Receipt
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
