"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Icon } from "@/components/icon";
import { useMoney } from "@/components/price";
import { useStore } from "@/components/providers";
import { sampleOffers } from "@/lib/account";
import { getProduct } from "@/lib/catalog";
import { compact, niceCeil } from "@/lib/format";
import { capDensity } from "@/lib/images";
import { useStored } from "@/lib/use-stored";
import type { CommissionView, CreatorDashboard } from "@/modules/affiliates";
import type { DisbursementView } from "@/modules/payments";
import { requestCreatorPayoutAction, setCreatorWalletAction } from "@/server/actions/creator";
import { MyVideos } from "./my-videos";

type ProductInfo = { title: string; image: string };
type Promote = { slug: string; title: string; image: string; price: number; rate: number };

const weekLabel = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const STATUS: Record<CommissionView["status"], { label: string; tone: string }> = {
  pending: { label: "Waiting for delivery", tone: "text-ink-2" },
  earned: { label: "Earned", tone: "text-positive" },
  void: { label: "Refunded", tone: "text-ink-3" },
};

/** Earn by posting what you love: earnings, links, payouts, and products worth promoting. */
export function CreatorHub({ data, available, payouts, products, promote }: { data: CreatorDashboard; available: number; payouts: DisbursementView[]; products: Record<string, ProductInfo>; promote: Promote[] }) {
  const money = useMoney();
  const { market } = useStore();
  const [hover, setHover] = useState<number | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const weeks = data.weeks;
  const max = Math.max(1, ...weeks.map((w) => w.earned));
  // Axis ticks are clean numbers in the shopper's own currency.
  const top = niceCeil(max * market.rate) / market.rate;
  const shown = hover ?? weeks.length - 1;
  const delta = data.earnedBefore > 0 ? (data.earned - data.earnedBefore) / data.earnedBefore : null;

  async function copy(slug: string) {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/p/${slug}?ref=${data.code}`);
      setCopied(slug);
    } catch {
      // Clipboard blocked.
    }
  }

  return (
    <div className="mx-auto max-w-[900px] px-3.5 pt-safe pb-36 lg:px-6 lg:pt-6 lg:pb-16">
      <header className="flex items-center gap-3 pt-2 pb-4 lg:pt-0">
        <Link href="/me" aria-label="Back" className="glass grid size-11 shrink-0 place-items-center rounded-full lg:hidden">
          <Icon name="back" className="size-5" />
        </Link>
        <div className="flex-1">
          <h1 className="font-display text-[30px] leading-tight font-extrabold tracking-[-0.03em]">Creator hub</h1>
          <p className="text-xs text-ink-2">Post what you love. Earn on every order your links bring in.</p>
        </div>
        <Link href="/creator/new" className="flex h-11 items-center gap-1.5 rounded-full bg-accent px-4 text-sm font-bold">
          <Icon name="plus" className="size-4" />
          Post
        </Link>
      </header>

      <section aria-label="The last 4 weeks" className="grid grid-cols-3 gap-2.5 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div className="glass col-span-3 rounded-[24px] p-4 lg:col-span-1">
          <p className="text-xs font-semibold text-ink-2">Earned, last 4 weeks</p>
          <p className="font-display text-[34px] leading-tight font-extrabold tracking-[-0.03em]">{money(data.earned)}</p>
          {delta !== null ? (
            <p className={`flex items-center gap-1 text-xs font-semibold ${delta >= 0 ? "text-positive" : "text-ink-2"}`}>
              <Icon name={delta >= 0 ? "up" : "down"} className="size-3.5" />
              {Math.abs(Math.round(delta * 100))}% vs the 4 weeks before
            </p>
          ) : (
            <p className="text-xs text-ink-2">{data.pending > 0 ? `${money(data.pending)} on its way once orders arrive` : "Share a link to start earning"}</p>
          )}
        </div>
        {[
          ["Clicks", compact(data.clicks)],
          ["Orders", data.orders.toLocaleString("en-US")],
          ["Conversion", data.clicks ? `${((data.orders / data.clicks) * 100).toFixed(1)}%` : "–"],
        ].map(([label, value]) => (
          <div key={label} className="glass-inset rounded-[24px] p-4">
            <p className="text-xs font-semibold text-ink-2">{label}</p>
            <p className="font-display text-2xl font-bold">{value}</p>
          </div>
        ))}
      </section>

      <section aria-labelledby="weekly-h" className="glass mt-4 rounded-[26px] p-4">
        <div className="flex items-baseline justify-between">
          <h2 id="weekly-h" className="text-[15px] font-bold">
            Earnings per week
          </h2>
          <p className="text-xs text-ink-2">
            Week of {weekLabel.format(new Date(weeks[shown].start))}: <b className="font-display text-sm font-bold text-ink">{money(weeks[shown].earned)}</b>
          </p>
        </div>
        <div className="mt-4 flex gap-2">
          <div aria-hidden="true" className="flex h-40 flex-col justify-between pb-5 text-right text-[10.5px] text-ink-3">
            <span>{money(top)}</span>
            <span>{money(top / 2)}</span>
            <span>0</span>
          </div>
          <div className="relative flex-1">
            <div aria-hidden="true" className="absolute inset-x-0 top-0 bottom-5 flex flex-col justify-between">
              {[0, 1, 2].map((i) => (
                <span key={i} className="h-px bg-white/[0.07]" />
              ))}
            </div>
            <ol className="relative flex h-40 items-end justify-around" onPointerLeave={() => setHover(null)}>
              {weeks.map((w, i) => (
                <li key={w.start} className="flex h-full flex-1 flex-col items-center justify-end">
                  <button
                    type="button"
                    onPointerEnter={() => setHover(i)}
                    onFocus={() => setHover(i)}
                    onBlur={() => setHover(null)}
                    aria-label={`Week of ${weekLabel.format(new Date(w.start))}: ${money(w.earned)}`}
                    className="group relative flex h-[calc(100%-20px)] w-full items-end justify-center"
                  >
                    <span
                      className={`w-full max-w-6 rounded-t-[4px] transition-opacity ${i === weeks.length - 1 ? "bg-series" : "bg-series/55"} ${hover !== null && hover !== i ? "opacity-60" : ""}`}
                      style={{ height: `${Math.max(w.earned > 0 ? 2 : 0, (w.earned / top) * 100)}%` }}
                    />
                  </button>
                  <span className="mt-1.5 h-3.5 text-[10px] whitespace-nowrap text-ink-3">{i % 2 === 1 ? weekLabel.format(new Date(w.start)) : ""}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>
        <table className="sr-only">
          <caption>Earnings per week</caption>
          <tbody>
            {weeks.map((w) => (
              <tr key={w.start}>
                <th scope="row">Week of {weekLabel.format(new Date(w.start))}</th>
                <td>{money(w.earned)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <Balance available={available} pending={data.pending} wallet={data.wallet} payouts={payouts} />

      <MyVideos />

      <section aria-labelledby="links-h" className="mt-5">
        <h2 id="links-h" className="mb-1 px-1 text-[15px] font-bold">
          Your links
        </h2>
        <p className="mb-3 px-1 text-xs text-ink-2">
          Your code is <b className="font-mono text-ink">{data.code}</b>. Any product link with <span className="font-mono">?ref={data.code}</span> counts for 7 days after someone taps it.
        </p>
        {data.links.length ? (
          <ul className="glass flex flex-col divide-y divide-line overflow-hidden rounded-[26px]">
            {data.links.map((l) => {
              const p = products[l.slug];
              if (!p) return null;
              return (
                <li key={l.slug} className="flex items-center gap-3 px-4 py-3">
                  <Image src={p.image} alt="" width={48} height={48} sizes="48px" className="size-12 rounded-xl object-cover" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{p.title}</span>
                    <span className="block text-xs text-ink-2">
                      {compact(l.clicks)} {l.clicks === 1 ? "click" : "clicks"} · {l.orders} {l.orders === 1 ? "order" : "orders"}
                    </span>
                  </span>
                  <button type="button" onClick={() => copy(l.slug)} className="text-xs font-semibold text-agent">
                    {copied === l.slug ? "Copied" : "Copy link"}
                  </button>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="glass-inset rounded-[22px] p-4 text-[13px] text-ink-2">No clicks yet. Copy a link below, or tap “Share” on any product, and post it where your audience is.</p>
        )}
      </section>

      {promote.length > 0 && (
        <section aria-labelledby="promote-h" className="mt-5">
          <h2 id="promote-h" className="mb-1 px-1 text-[15px] font-bold">
            Worth promoting
          </h2>
          <p className="mb-3 px-1 text-xs text-ink-2">Best sellers, and what each shop pays you per order.</p>
          <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
            {promote.map((p) => (
              <li key={p.slug} className="glass-inset overflow-hidden rounded-[22px]">
                <Link href={`/p/${p.slug}`} className="relative block aspect-square">
                  <Image src={p.image} alt="" fill sizes={capDensity("(min-width: 640px) 25vw, 50vw")} className="object-cover" />
                  <span className="absolute top-2 left-2 rounded-full bg-black/70 px-2 py-0.5 text-[11px] font-bold text-positive">{Math.round(p.rate * 100)}%</span>
                </Link>
                <span className="flex flex-col gap-2 p-3">
                  <span className="line-clamp-2 text-[13px] leading-snug font-semibold">{p.title}</span>
                  <span className="text-xs text-ink-2">
                    You earn about <b className="text-ink">{money(p.price * p.rate)}</b> each
                  </span>
                  <button type="button" onClick={() => copy(p.slug)} className="h-9 rounded-full bg-white text-xs font-bold text-black">
                    {copied === p.slug ? "Link copied" : "Copy my link"}
                  </button>
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {data.recent.length > 0 && (
        <section aria-labelledby="recent-h" className="mt-5">
          <h2 id="recent-h" className="mb-3 px-1 text-[15px] font-bold">
            Recent orders from your links
          </h2>
          <ul className="glass flex flex-col divide-y divide-line overflow-hidden rounded-[26px]">
            {data.recent.map((c) => {
              const first = c.slugs.map((s) => products[s]).find(Boolean);
              return (
                <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">
                      {first?.title ?? "An order"}
                      {c.slugs.length > 1 && <span className="font-normal text-ink-2"> + {c.slugs.length - 1} more</span>}
                    </span>
                    <span className={`block text-xs ${STATUS[c.status].tone}`}>
                      {STATUS[c.status].label} · {Math.round(c.rate * 100)}% of {money(c.base)}
                    </span>
                  </span>
                  <span className={`font-display text-sm font-bold ${c.status === "void" ? "text-ink-3 line-through" : ""}`}>{money(c.amount)}</span>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <Samples />
    </div>
  );
}

/** What's ready to withdraw, the wallet it goes to, and payouts so far. */
function Balance({ available, pending, wallet, payouts }: { available: number; pending: number; wallet: string | null; payouts: DisbursementView[] }) {
  const money = useMoney();
  const router = useRouter();
  const [editing, setEditing] = useState(!wallet);
  const [address, setAddress] = useState(wallet ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const saveWallet = () =>
    start(async () => {
      const r = await setCreatorWalletAction(address);
      if (!r.ok) return setError(r.message);
      setError(null);
      setEditing(false);
      router.refresh();
    });
  const withdraw = () =>
    start(async () => {
      const r = await requestCreatorPayoutAction(available);
      if (!r.ok) return setError(r.message);
      setError(null);
      router.refresh();
    });

  return (
    <section aria-labelledby="balance-h" className="glass mt-4 flex flex-col gap-3 rounded-[26px] p-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 id="balance-h" className="text-xs font-semibold text-ink-2">
            Ready to withdraw
          </h2>
          <p className="font-display text-[28px] leading-tight font-extrabold">{money(available)}</p>
          {pending > 0 && <p className="text-xs text-ink-2">{money(pending)} more once those orders arrive</p>}
        </div>
        <button type="button" disabled={busy || available < 20 || !wallet} onClick={withdraw} className="h-11 rounded-full bg-white px-5 text-sm font-bold text-black disabled:opacity-40">
          Withdraw
        </button>
      </div>
      {editing ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            saveWallet();
          }}
          className="flex gap-2"
        >
          <label className="sr-only" htmlFor="creator-wallet">
            USDC wallet on Base
          </label>
          <input
            id="creator-wallet"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="Your USDC wallet on Base (0x…)"
            autoComplete="off"
            spellCheck={false}
            className="glass-inset h-11 min-w-0 flex-1 rounded-full px-4 font-mono text-[13px] outline-none"
          />
          <button type="submit" disabled={busy} className="h-11 rounded-full bg-accent px-4 text-sm font-bold disabled:opacity-50">
            Save
          </button>
        </form>
      ) : (
        <p className="flex items-center gap-2 text-xs text-ink-2">
          Paid in USDC on Base to <span className="truncate font-mono text-ink">{wallet}</span>
          <button type="button" onClick={() => setEditing(true)} className="shrink-0 font-semibold text-agent">
            Change
          </button>
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs font-semibold text-like">
          {error}
        </p>
      )}
      <p className="text-[11px] text-ink-3">Withdrawals start at $20 and are sent within two working days. Earnings count once the buyer&apos;s parcel arrives.</p>
      {payouts.length > 0 && (
        <ul className="flex flex-col gap-1 border-t border-line pt-3 text-xs">
          {payouts.map((p) => (
            <li key={p.id} className="flex justify-between gap-2">
              <span className="text-ink-2">
                {new Date(p.requestedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })} · {p.status === "sent" ? "Sent" : p.status === "cancelled" ? `Cancelled${p.note ? `: ${p.note}` : ""}` : "On its way"}
              </span>
              <b className="font-semibold">{money(p.amount)}</b>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** Free samples factories offer creators (requests are kept on this device for now). */
function Samples() {
  const [samples, setSamples] = useStored<string[]>("app.samples", []);
  return (
    <section aria-labelledby="samples-h" className="mt-5">
      <h2 id="samples-h" className="mb-1 px-1 text-[15px] font-bold">
        Free samples for creators
      </h2>
      <p className="mb-3 px-1 text-xs text-ink-2">Factories send these free if you post a video within 14 days.</p>
      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {sampleOffers.map((slug) => {
          const p = getProduct(slug);
          if (!p) return null;
          const asked = samples.includes(slug);
          return (
            <li key={slug} className="glass-inset overflow-hidden rounded-[22px]">
              <span className="relative block aspect-square">
                <Image src={p.images[0]} alt="" fill sizes={capDensity("(min-width: 640px) 25vw, 50vw")} className="object-cover" />
              </span>
              <span className="flex flex-col gap-2 p-3">
                <span className="line-clamp-2 text-[13px] leading-snug font-semibold">{p.title}</span>
                <button
                  type="button"
                  onClick={() => setSamples(asked ? samples : [...samples, slug])}
                  className={`h-9 rounded-full text-xs font-bold ${asked ? "bg-positive/15 text-positive" : "bg-white text-black"}`}
                >
                  {asked ? "Requested" : "Request sample"}
                </button>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export function CreatorHubSkeleton() {
  return (
    <div aria-busy="true" className="mx-auto flex max-w-[900px] flex-col gap-4 px-3.5 pt-safe pb-36 lg:px-6 lg:pt-6">
      <div className="skeleton mt-2 h-12 w-48 rounded-2xl" />
      <div className="grid grid-cols-3 gap-2.5">
        <div className="skeleton col-span-3 h-28 rounded-[24px]" />
        {[0, 1, 2].map((i) => (
          <div key={i} className="skeleton h-20 rounded-[24px]" />
        ))}
      </div>
      <div className="skeleton h-56 rounded-[26px]" />
    </div>
  );
}
