"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { Icon } from "@/components/icon";
import { Confetti } from "@/components/motion/confetti";
import { useMoney } from "@/components/price";
import { haptic } from "@/lib/feedback";
import { clock as formatClock, formatMoney } from "@/lib/format";
import { useNow } from "@/lib/use-now";
import type { InvoiceView } from "@/modules/payments";
import { simulatePaymentAction } from "@/server/actions/payments";
import { QrCode } from "./qr-code";

const POLL_MS = 4_000;

/** Pay an order or ad credit in stablecoins: exact amount, address, QR and wallet link, then live confirmation. */
export function InvoiceScreen({ initial, orderNumber, priceUpdated = false }: { initial: InvoiceView; orderNumber: string | null; priceUpdated?: boolean }) {
  const money = useMoney();
  const now = useNow(1000);
  const [invoice, setInvoice] = useState(initial);
  const [copied, setCopied] = useState<"amount" | "address" | null>(null);
  const [simulating, startSimulate] = useTransition();
  const pending = invoice.status === "pending";
  // Ad credit has no order: it comes from, and goes back to, the shop's Promote page.
  const adCredit = invoice.adSellerId !== null;
  const back = adCredit ? "/sell/ads" : "/checkout";
  const about = adCredit ? "Ad credit" : `Order ${orderNumber}`;
  const left = now === null ? null : Math.max(0, (Date.parse(invoice.expiresAt) - now) / 1000);

  // Ask the server to check the chain every few seconds until it's settled.
  useEffect(() => {
    if (!pending) return;
    const t = setInterval(async () => {
      try {
        const res = await fetch(`/api/invoices/${invoice.id}`, { cache: "no-store" });
        if (res.ok) setInvoice((await res.json()) as InvoiceView);
      } catch {
        // Offline for a moment: the next poll tries again.
      }
    }, POLL_MS);
    return () => clearInterval(t);
  }, [pending, invoice.id]);

  useEffect(() => {
    if (invoice.status === "paid") haptic([12, 40, 24]);
  }, [invoice.status]);

  async function copy(what: "amount" | "address") {
    try {
      await navigator.clipboard.writeText(what === "amount" ? invoice.exactAmount : invoice.payTo);
      setCopied(what);
      setTimeout(() => setCopied(null), 1600);
    } catch {
      // Clipboard blocked: the text is still selectable.
    }
  }

  function simulate() {
    startSimulate(async () => {
      if (await simulatePaymentAction(invoice.id)) {
        const res = await fetch(`/api/invoices/${invoice.id}`, { cache: "no-store" });
        if (res.ok) setInvoice((await res.json()) as InvoiceView);
      }
    });
  }

  if (invoice.status === "paid") {
    return (
      <div className="grid min-h-dvh place-items-center px-5">
        <Confetti />
        <div role="status" className="glass-sheet flex w-full max-w-sm flex-col items-center gap-2 rounded-[38px] px-6 pt-8 pb-6 text-center">
          <span className="mb-2 grid size-[76px] place-items-center rounded-full bg-positive text-black shadow-[0_10px_30px_rgb(127_224_180/0.35)]">
            <Icon name="check" className="size-10" strokeWidth={3} />
          </span>
          <h1 className="font-display text-2xl font-extrabold tracking-[-0.02em]">Payment received</h1>
          <p className="text-sm text-ink-2">
            {about} · {formatMoney(invoice.amount, "USD")} in {invoice.asset}
          </p>
          <p className="mb-1 text-sm leading-relaxed text-ink-2">{adCredit ? "It's in your ad credit, and your campaigns can spend it now." : "Protect holds it until your order arrives as described. The sellers are packing now."}</p>
          {invoice.txHash && <p className="mb-2 max-w-full truncate font-mono text-[11px] text-ink-3">tx {invoice.txHash}</p>}
          <Link href={adCredit ? back : `/orders/${orderNumber}`} className="grid h-[52px] w-full place-items-center rounded-full bg-accent text-[15px] font-bold">
            {adCredit ? "Back to Promote" : "Track order"}
          </Link>
          {!adCredit && (
            <Link href="/" className="glass-inset grid h-[52px] w-full place-items-center rounded-full text-[15px] font-semibold">
              Keep watching
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[520px] px-3.5 pt-safe pb-16">
      <header className="flex items-center gap-3 pt-2 pb-4">
        <Link href={back} aria-label={adCredit ? "Back to Promote" : "Back to bag"} className="glass grid size-11 shrink-0 place-items-center rounded-full">
          <Icon name="back" className="size-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-xl font-bold">Pay {formatMoney(invoice.amount, "USD")}</h1>
          <p className="text-xs text-ink-2">
            {about} · about {money(invoice.amount)}
          </p>
        </div>
        {pending && left !== null && (
          <span role="timer" aria-label="Time left to pay" className="glass-inset flex h-9 items-center gap-1.5 rounded-full px-3 font-display text-sm font-bold tabular-nums">
            <Icon name="clock" className="size-4 text-ink-2" />
            {formatClock(left)}
          </span>
        )}
      </header>

      {priceUpdated && pending && (
        <p role="status" className="mb-3 flex items-start gap-2 rounded-2xl bg-series/12 p-3 text-[13px] text-ink-2 ring-1 ring-series/30">
          <Icon name="bell" className="mt-0.5 size-4 shrink-0 text-[#7db4ff]" />
          <span>
            <b className="font-semibold text-ink">Your total changed to {formatMoney(invoice.amount, "USD")}.</b> We price every order from the current listings; a deal or sale may have ended.
          </span>
        </p>
      )}

      {invoice.simulated && (
        <p className="mb-3 flex items-start gap-2 rounded-2xl bg-save/12 p-3 text-[13px] text-save ring-1 ring-save/30">
          <Icon name="flag" className="mt-0.5 size-4 shrink-0" />
          <span>
            <b className="font-semibold">Test mode.</b> No real money moves. Don&apos;t send funds to this address; use “Simulate payment” below.
          </span>
        </p>
      )}

      {invoice.status === "expired" ? (
        <section className="glass flex flex-col items-center gap-2 rounded-[30px] p-6 text-center">
          <Icon name="clock" className="size-10 text-ink-3" />
          <h2 className="font-display text-xl font-bold">This payment window closed</h2>
          <p className="text-sm text-ink-2">Nothing was charged. If you already sent the funds, they&apos;ll still be matched to your {adCredit ? "credit" : "order"}; contact us with the transaction hash.</p>
          <Link href={back} className="mt-2 grid h-12 w-full place-items-center rounded-full bg-white text-[15px] font-bold text-black">
            {adCredit ? "Back to Promote" : "Back to your bag"}
          </Link>
        </section>
      ) : (
        <section className="glass flex flex-col gap-4 rounded-[30px] p-4">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-[13px] font-semibold">
              <span className="relative flex size-2.5">
                <span className="absolute inset-0 animate-ping rounded-full bg-positive/70" />
                <span className="relative size-2.5 rounded-full bg-positive" />
              </span>
              Waiting for your transfer
            </span>
            <span className="rounded-full bg-series/20 px-2.5 py-1 text-xs font-bold text-[#7db4ff]">
              {invoice.asset} on {invoice.network}
            </span>
          </div>

          <div className="mx-auto w-full max-w-[240px]">
            <QrCode value={invoice.paymentUri ?? invoice.payTo} label={`QR code to pay ${invoice.exactAmount} ${invoice.asset}`} className="w-full" />
          </div>

          <div>
            <p className="text-[12px] font-semibold text-ink-2">Send exactly</p>
            <button type="button" onClick={() => copy("amount")} className="glass-inset mt-1 flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left">
              <span className="font-display text-[24px] leading-none font-extrabold tabular-nums">
                {invoice.exactAmount} <span className="text-base text-ink-2">{invoice.asset}</span>
              </span>
              <span className="flex items-center gap-1 text-xs font-semibold text-ink-2">
                <Icon name={copied === "amount" ? "check" : "share"} className="size-4" />
                {copied === "amount" ? "Copied" : "Copy"}
              </span>
            </button>
            <p className="mt-1.5 text-[11.5px] text-ink-3">The last digits identify your {adCredit ? "payment" : "order"}, so send this exact amount.</p>
          </div>

          <div>
            <p className="text-[12px] font-semibold text-ink-2">To this {invoice.network} address</p>
            <button type="button" onClick={() => copy("address")} className="glass-inset mt-1 flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left">
              <span className="min-w-0 font-mono text-[13px] break-all">{invoice.payTo}</span>
              <span className="flex shrink-0 items-center gap-1 text-xs font-semibold text-ink-2">
                <Icon name={copied === "address" ? "check" : "share"} className="size-4" />
                {copied === "address" ? "Copied" : "Copy"}
              </span>
            </button>
          </div>

          <p className="flex gap-2 rounded-2xl bg-like/10 p-3 text-[12.5px] text-ink-2">
            <Icon name="shield" className="mt-0.5 size-4 shrink-0 text-like" />
            <span>
              Send only <b className="text-ink">{invoice.asset}</b> on <b className="text-ink">{invoice.network}</b>. Other tokens or networks can&apos;t be recovered.
            </span>
          </p>

          <div className="flex flex-col gap-2">
            {invoice.paymentUri && (
              <a href={invoice.paymentUri} className="grid h-12 place-items-center rounded-full bg-accent text-[15px] font-bold">
                Open in my wallet
              </a>
            )}
            {invoice.simulated && (
              <button type="button" onClick={simulate} disabled={simulating} className="h-12 rounded-full bg-white text-[15px] font-bold text-black disabled:opacity-60">
                {simulating ? "Sending test payment…" : "Simulate payment"}
              </button>
            )}
          </div>
        </section>
      )}

      <p className="mt-4 px-2 text-center text-xs text-ink-3">We check the network every few seconds. You can leave this page; {adCredit ? "your credit" : "the order"} updates on its own.</p>
    </div>
  );
}
