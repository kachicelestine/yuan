"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Icon } from "@/components/icon";
import { useMoney } from "@/components/price";
import { useStore } from "@/components/providers";
import { useNow } from "@/lib/use-now";
import type { DepositOfferView } from "@/modules/engagement";
import { placeDepositAction } from "@/server/actions/deposits";

type Item = DepositOfferView & { product: { title: string; image: string; price: number | null } };

const day = (iso: string) => new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
const dayTime = (iso: string) => new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/** Pre-orders and 11.11 pre-sales: a deposit now, the balance in its window. */
export function DepositOffers({ items, signedIn }: { items: Item[]; signedIn: boolean }) {
  if (!items.length) return null;
  return (
    <section id="deposits" aria-labelledby="deposits-h" className="scroll-mt-20">
      <h2 id="deposits-h" className="font-display text-2xl font-extrabold tracking-[-0.02em]">
        Pre-orders and pre-sales
      </h2>
      <p className="mb-3 text-sm text-ink-2">Put a deposit down now and pay the rest when its window opens. Protect holds the deposit until your order arrives.</p>
      <ul className="grid gap-3 lg:grid-cols-2">
        {items.map((o) => (
          <li key={o.id}>
            <OfferCard offer={o} signedIn={signedIn} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function OfferCard({ offer: o, signedIn }: { offer: Item; signedIn: boolean }) {
  const money = useMoney();
  const router = useRouter();
  const { addToCart, market } = useStore();
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const now = useNow(60_000);
  const balanceOpen = now !== null && now >= Date.parse(o.balanceFrom) && now < Date.parse(o.balanceUntil);
  const paid = o.mine.find((m) => m.status === "paid");
  const latest = o.mine.at(-1);
  const presale = o.kind === "presale";

  function payDeposit() {
    setError(null);
    start(async () => {
      const r = await placeDepositAction(o.id, market.code);
      if (!r.ok) return setError(r.message);
      router.push(`/pay/${r.invoiceId}`);
    });
  }

  function payBalance() {
    addToCart({ slug: o.slug, title: o.product.title, image: o.product.image, option: undefined, unitPrice: o.balance, qty: 1, note: presale ? "11.11 pre-sale balance" : "Pre-order balance" });
    router.push("/checkout");
  }

  let action: React.ReactNode;
  if (paid && balanceOpen) {
    action = (
      <button type="button" onClick={payBalance} className="h-11 flex-1 rounded-full bg-accent text-sm font-bold">
        Pay the balance · {money(o.balance)}
      </button>
    );
  } else if (paid) {
    action = <p className="flex-1 text-[13px] font-semibold text-positive">Deposit paid · balance opens {dayTime(o.balanceFrom)}</p>;
  } else if (latest?.status === "converted") {
    action = <p className="flex-1 text-[13px] font-semibold text-positive">Balance paid. It ships with your order.</p>;
  } else if (latest?.status === "pending") {
    action = (
      <Link href="/me#orders" className="grid h-11 flex-1 place-items-center rounded-full bg-white/10 text-sm font-semibold">
        Finish paying your deposit
      </Link>
    );
  } else if (latest?.status === "forfeited") {
    action = <p className="flex-1 text-[13px] text-ink-2">The balance window closed, so the deposit went to the shop.</p>;
  } else if (latest?.status === "refunded") {
    action = <p className="flex-1 text-[13px] text-ink-2">Your deposit is being refunded.</p>;
  } else if (o.state === "upcoming") {
    action = <p className="flex-1 text-[13px] text-ink-2">Deposits open {dayTime(o.opensAt)}</p>;
  } else if (o.state === "closed" || o.left === 0) {
    action = <p className="flex-1 text-[13px] text-ink-2">{o.left === 0 ? "All the deposits are taken." : "Deposits have closed."}</p>;
  } else if (!signedIn) {
    action = (
      <Link href="/signin?next=/drops%23deposits" className="grid h-11 flex-1 place-items-center rounded-full bg-accent text-sm font-bold">
        Sign in to put a deposit down
      </Link>
    );
  } else {
    action = (
      <button type="button" onClick={payDeposit} disabled={busy} className="h-11 flex-1 rounded-full bg-accent text-sm font-bold disabled:opacity-60">
        {busy ? "Preparing…" : `Put down ${money(o.deposit)}`}
      </button>
    );
  }

  return (
    <article className="glass flex h-full flex-col gap-3 rounded-[26px] p-4">
      <div className="flex items-start gap-3">
        <Link href={`/p/${o.slug}`} className="relative size-[72px] shrink-0 overflow-hidden rounded-2xl">
          <Image src={o.product.image} alt="" fill sizes="72px" className="object-cover" />
        </Link>
        <div className="min-w-0 flex-1">
          <span className={`inline-block rounded-full px-2 py-0.5 text-[10.5px] font-bold ${presale ? "bg-accent/20 text-accent-light" : "bg-series/20 text-series"}`}>{presale ? "11.11 PRE-SALE" : "PRE-ORDER"}</span>
          <h3 className="mt-1 text-[15px] leading-snug font-semibold">{o.title}</h3>
          {o.blurb && <p className="text-xs text-ink-2">{o.blurb}</p>}
        </div>
      </div>
      <dl className="grid grid-cols-3 gap-1.5 text-center text-[11px]">
        {[
          ["Deposit now", money(o.deposit)],
          [presale ? "Counts as" : "Counts as", money(o.credit)],
          ["Balance", money(o.balance)],
        ].map(([k, v]) => (
          <div key={k} className="rounded-xl bg-white/[0.05] py-1.5">
            <dt className="text-ink-3">{k}</dt>
            <dd className="font-display text-sm font-bold">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="text-[11.5px] leading-snug text-ink-3">
        {presale ? "Balance due on 11.11, Beijing time" : `Balance open ${day(o.balanceFrom)}–${day(o.balanceUntil)}`}. If it isn&apos;t paid in time, the deposit goes to the shop; if the shop cancels, you get it back.{" "}
        {o.state === "open" ? `${o.left} left.` : ""}
      </p>
      {error && (
        <p role="alert" className="text-[13px] text-like">
          {error}
        </p>
      )}
      <div className="mt-auto flex items-center gap-2">
        {action}
        {!paid && <Icon name="shield" className="size-5 shrink-0 text-positive" aria-label="Held by Protect" />}
      </div>
    </article>
  );
}
