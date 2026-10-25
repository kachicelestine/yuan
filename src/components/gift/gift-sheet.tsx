"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Icon } from "@/components/icon";
import { Flag } from "@/components/market/flag";
import { useMoney } from "@/components/price";
import { useStore } from "@/components/providers";
import { Sheet, type Detent } from "@/components/sheet";
import { unitPrice, type Product } from "@/lib/catalog";
import { choosable, getTheme, giftThemes, type GiftTheme } from "@/lib/gifts";
import { landedCost } from "@/lib/landed";
import { sendGiftAction } from "@/server/actions/gifts";

/** "Send as a gift" on the product page: pick who and where, write the card, and pay for it all. */
export function GiftButton({ product }: { product: Product }) {
  const { markets } = useStore();
  const [detent, setDetent] = useState<Detent>("closed");
  if (product.price === undefined) return null;
  return (
    <>
      <button type="button" onClick={() => setDetent("full")} className="glass-inset flex w-full items-center gap-3 rounded-[20px] p-3.5 text-left">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-like/15 text-like">
          <Icon name="gift" className="size-5" />
        </span>
        <span className="min-w-0 flex-1 text-sm">
          <b className="block font-semibold">Send it as a gift</b>
          <span className="text-xs text-ink-2">To anyone in {markets.length} countries. Duties prepaid; they add their own address.</span>
        </span>
        <Icon name="forward" className="size-4 text-ink-3" />
      </button>
      <Sheet detent={detent} onDetent={setDetent} label="Send as a gift">
        <GiftForm product={product} onClose={() => setDetent("closed")} />
      </Sheet>
    </>
  );
}

function GiftForm({ product, onClose }: { product: Product; onClose: () => void }) {
  const money = useMoney();
  const router = useRouter();
  const { markets, market, account } = useStore();
  const [to, setTo] = useState("");
  const [from, setFrom] = useState("");
  const [where, setWhere] = useState(market.code);
  const [theme, setTheme] = useState<GiftTheme["id"]>("thanks");
  const [message, setMessage] = useState("");
  const [hidePrice, setHidePrice] = useState(true);
  // Only an option whose values all cost the same can be left to them.
  const option = product.options?.find(choosable);
  const [theyChoose, setTheyChoose] = useState(!!option);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const there = markets.find((m) => m.code === where) ?? market;
  const landed = landedCost(unitPrice(product, 1), product.dutyRate, there);
  const look = getTheme(theme);
  const name = to.trim() || "your friend";

  function send() {
    setError(null);
    start(async () => {
      const r = await sendGiftAction({ slug: product.slug, option: null, chooseOption: theyChoose && option ? option.name : null, country: there.code, recipientName: to, fromName: from, theme, message, hidePrice });
      if (!r.ok) return setError(r.message);
      router.push(`/pay/${r.invoiceId}`);
    });
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 touch-none items-center gap-3 px-4 pt-1 pb-3">
        <h2 className="flex-1 font-display text-[22px] font-bold">Send as a gift</h2>
        <button type="button" onClick={onClose} aria-label="Close" className="glass-inset grid size-9 place-items-center rounded-full">
          <Icon name="close" className="size-[18px]" />
        </button>
      </header>

      <div data-sheet-scroll className="pb-safe flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 [&>*]:shrink-0">
        <div className={`relative overflow-hidden rounded-[26px] p-5 ${look.bg}`}>
          <span aria-hidden="true" className="seal absolute -right-2 -bottom-4 text-[84px] leading-none text-white/15">
            {look.seal}
          </span>
          <p className="text-xs font-bold tracking-[0.12em] text-white/75">{look.label.toUpperCase()}</p>
          <p className="mt-2 font-display text-2xl leading-tight font-extrabold">To {name}</p>
          <p className="mt-1.5 max-w-[30ch] text-sm leading-snug text-white/90">{message.trim() || "Your note goes here, in your words."}</p>
          <p className="mt-3 text-xs font-semibold text-white/80">
            From {from.trim() || "you"} · {product.title}
          </p>
        </div>

        <section aria-labelledby="who-h">
          <h3 id="who-h" className="mb-2 text-[13px] font-semibold text-ink-2">
            Who&apos;s it for, and where?
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Their first name" aria-label="Their first name" maxLength={40} className="glass-inset h-12 w-full rounded-2xl px-4 text-[15px] outline-none placeholder:text-ink-3 focus:ring-2 focus:ring-white/40" />
            <input value={from} onChange={(e) => setFrom(e.target.value)} placeholder="Sign it as" aria-label="Sign the card as" maxLength={40} className="glass-inset h-12 w-full rounded-2xl px-4 text-[15px] outline-none placeholder:text-ink-3 focus:ring-2 focus:ring-white/40" />
          </div>
          <label className="glass-inset relative mt-2 flex h-12 items-center gap-2.5 rounded-2xl pr-10 pl-3">
            <Flag code={there.code} className="size-7 shrink-0" />
            <span className="sr-only">Their country</span>
            <select value={where} onChange={(e) => setWhere(e.target.value)} className="h-full min-w-0 flex-1 appearance-none bg-transparent text-[15px] outline-none">
              {markets.map((m) => (
                <option key={m.code} value={m.code} className="bg-raised">
                  {m.name}
                </option>
              ))}
            </select>
            <Icon name="down" className="absolute top-1/2 right-3.5 size-4 -translate-y-1/2 text-ink-2" />
          </label>
        </section>

        <section aria-labelledby="card-h">
          <h3 id="card-h" className="mb-2 text-[13px] font-semibold text-ink-2">
            The card
          </h3>
          <div role="radiogroup" aria-label="Card design" className="grid grid-cols-4 gap-2">
            {giftThemes.map((t) => (
              <button key={t.id} type="button" role="radio" aria-checked={theme === t.id} onClick={() => setTheme(t.id)} className="flex flex-col items-center gap-1 text-[11px] font-semibold text-ink-2">
                <span className={`seal grid aspect-[4/3] w-full place-items-center rounded-xl text-lg text-white/90 ${t.bg} ${theme === t.id ? "ring-2 ring-white" : ""}`}>{t.seal.slice(0, 2)}</span>
                {t.label}
              </button>
            ))}
          </div>
          <label className="mt-3 block">
            <span className="sr-only">Message</span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              maxLength={200}
              rows={3}
              placeholder="Write a note. The shop prints it on the card."
              className="glass-inset w-full resize-none rounded-2xl px-4 py-3 text-[15px] outline-none placeholder:text-ink-3 focus:ring-2 focus:ring-white/40"
            />
            <span className="block text-right text-[11px] text-ink-3">{message.length}/200</span>
          </label>
        </section>

        <section aria-label="Gift options" className="glass-inset flex flex-col divide-y divide-line rounded-[20px]">
          <Toggle label="Hide the price" detail="Their link and the parcel don't show what you paid" on={hidePrice} onChange={setHidePrice} />
          {option && <Toggle label={`Let them choose the ${option.name.toLowerCase()}`} detail={`They pick from ${option.values.length} when they open it`} on={theyChoose} onChange={setTheyChoose} />}
        </section>

        <section aria-label="Total" className="rounded-[20px] bg-white/[0.04] p-4">
          <dl className="flex flex-col gap-1.5 text-[13px] text-ink-2">
            <div className="flex justify-between">
              <dt>Gift</dt>
              <dd className="text-ink">{money(landed.item)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="flex items-center gap-1.5">
                Shipping and duties to <Flag code={there.code} className="size-4" /> {there.name}
              </dt>
              <dd className="text-ink">{money(landed.total - landed.item)}</dd>
            </div>
            <div className="mt-1 flex justify-between border-t border-line pt-2 text-[15px] font-bold text-ink">
              <dt>About</dt>
              <dd className="font-display">{money(landed.total)}</dd>
            </div>
          </dl>
          <p className="mt-2 flex items-center gap-1.5 text-xs text-positive">
            <Icon name="check" className="size-3.5" />
            {name === "your friend" ? "They pay" : `${name} pays`} nothing at the door
          </p>
        </section>

        {error && (
          <p role="alert" className="text-[13px] text-like">
            {error}
          </p>
        )}
        {account ? (
          <button type="button" onClick={send} disabled={busy || !to.trim() || !from.trim()} className="mb-4 h-[52px] shrink-0 rounded-full bg-accent text-[15px] font-bold disabled:opacity-40">
            {busy ? "Preparing…" : !to.trim() ? "Say who it's for" : !from.trim() ? "Sign the card" : "Pay for the gift"}
          </button>
        ) : (
          <Link href={`/signin?next=/p/${product.slug}`} className="mb-4 grid h-[52px] shrink-0 place-items-center rounded-full bg-accent text-[15px] font-bold">
            Sign in to send a gift
          </Link>
        )}
        <p className="-mt-2 mb-4 text-center text-xs text-ink-3">After you pay, you get a private link to send {name}. They open it, {theyChoose && option ? `pick their ${option.name.toLowerCase()}, ` : ""}and add their address.</p>
      </div>
    </div>
  );
}

function Toggle({ label, detail, on, onChange }: { label: string; detail: string; on: boolean; onChange: (on: boolean) => void }) {
  return (
    <label className="flex cursor-pointer items-center gap-3 px-4 py-3">
      <span className="min-w-0 flex-1">
        <b className="block text-sm font-semibold">{label}</b>
        <span className="block text-xs text-ink-2">{detail}</span>
      </span>
      <input type="checkbox" role="switch" checked={on} onChange={(e) => onChange(e.target.checked)} className="peer sr-only" />
      <span className="relative h-7 w-12 shrink-0 rounded-full bg-white/20 transition-colors peer-checked:bg-positive peer-focus-visible:ring-2 peer-focus-visible:ring-white">
        <span className={`absolute top-1 left-1 size-5 rounded-full bg-white transition-transform duration-500 ease-spring ${on ? "translate-x-5" : ""}`} />
      </span>
    </label>
  );
}
