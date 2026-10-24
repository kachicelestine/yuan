"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/icon";
import { Flag } from "@/components/market/flag";
import { useMoney } from "@/components/price";
import { useStore } from "@/components/providers";
import { Sheet, type Detent } from "@/components/sheet";
import { unitPrice, type Gift, type Product } from "@/lib/catalog";
import { getTheme, giftThemes, wrapPrice } from "@/lib/gifts";
import { landedCost } from "@/lib/landed";
import { useStored } from "@/lib/use-stored";

/** "Send as a gift" on the product page: pick who and where, write the card, and prepay everything. */
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
          <span className="text-xs text-ink-2">To anyone in {markets.length} countries. Duties prepaid, price hidden.</span>
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
  const { markets, market, addToCart } = useStore();
  const [gifts, setGifts] = useStored<Gift[]>("app.gifts", []);
  const [to, setTo] = useState("");
  const [where, setWhere] = useState(market.code === "GH" ? "NG" : "GH");
  const [theme, setTheme] = useState("thanks");
  const [message, setMessage] = useState("");
  const [hidePrice, setHidePrice] = useState(true);
  const [theyChoose, setTheyChoose] = useState(true);
  const [wrap, setWrap] = useState(true);
  const [done, setDone] = useState(false);
  const there = markets.find((m) => m.code === where) ?? market;
  const option = product.options?.[0];
  const item = unitPrice(product, 1) + (wrap ? wrapPrice : 0);
  const landed = landedCost(item, product.dutyRate, there);
  const look = getTheme(theme);
  const name = to.trim() || "your friend";

  function send() {
    const gift: Gift = { id: `g-${gifts.length + 1}`, slug: product.slug, from: "You", to: name, market: where, theme, message: message.trim(), hidePrice, theyChoose: theyChoose && !!option, wrap };
    setGifts([...gifts, gift]);
    addToCart({ slug: product.slug, title: product.title, image: product.images[0], option: gift.theyChoose ? `${option?.name}: they choose` : undefined, unitPrice: landed.total, qty: 1, note: `Gift for ${name} · ${there.name}, duties paid` });
    setDone(true);
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
          <p className="mt-3 text-xs font-semibold text-white/80">From you · {product.title}</p>
        </div>

        {done ? (
          <div className="glass-inset rounded-[22px] p-4 text-center">
            <span className="mx-auto grid size-12 place-items-center rounded-full bg-positive/15 text-positive">
              <Icon name="check" className="size-6" />
            </span>
            <h3 className="mt-2 font-display text-lg font-bold">Gift in your bag</h3>
            <p className="text-[13px] text-ink-2">
              After you pay, {name} gets a link to unwrap it{theyChoose && option ? `, pick their ${option.name.toLowerCase()}` : ""} and add their address in {there.name}.
            </p>
            <div className="mt-3 flex flex-col gap-2">
              <Link href="/gift?g=mine" className="flex h-11 items-center justify-center rounded-full bg-white text-sm font-bold text-black">
                Preview what {name} sees
              </Link>
              <Link href="/checkout" className="flex h-11 items-center justify-center rounded-full bg-white/10 text-sm font-semibold">
                Go to checkout
              </Link>
            </div>
          </div>
        ) : (
          <>
            <section aria-labelledby="who-h">
              <h3 id="who-h" className="mb-2 text-[13px] font-semibold text-ink-2">
                Who&apos;s it for?
              </h3>
              <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="Their first name" maxLength={30} className="glass-inset h-12 w-full rounded-2xl px-4 text-[15px] outline-none placeholder:text-ink-3 focus:ring-2 focus:ring-white/40" />
              <ul className="no-scrollbar -mx-4 mt-2 flex gap-1.5 overflow-x-auto px-4">
                {markets.map((m) => (
                  <li key={m.code}>
                    <button
                      type="button"
                      aria-pressed={where === m.code}
                      onClick={() => setWhere(m.code)}
                      className={`flex h-10 shrink-0 items-center gap-1.5 rounded-full pr-3 pl-1.5 text-[13px] font-semibold whitespace-nowrap transition-colors ${where === m.code ? "bg-white text-black" : "glass-inset text-ink-2"}`}
                    >
                      <Flag code={m.code} className="size-7" />
                      {m.name}
                    </button>
                  </li>
                ))}
              </ul>
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
                  maxLength={140}
                  rows={3}
                  placeholder="Write a note. We print it on the card."
                  className="glass-inset w-full resize-none rounded-2xl px-4 py-3 text-[15px] outline-none placeholder:text-ink-3 focus:ring-2 focus:ring-white/40"
                />
                <span className="block text-right text-[11px] text-ink-3">{message.length}/140</span>
              </label>
            </section>

            <section aria-label="Gift options" className="glass-inset flex flex-col divide-y divide-line rounded-[20px]">
              <Toggle label="Hide the price" detail="Nothing in the parcel or the link shows what you paid" on={hidePrice} onChange={setHidePrice} />
              {option && <Toggle label={`Let them choose the ${option.name.toLowerCase()}`} detail={`They pick from ${option.values.length} options when they unwrap it`} on={theyChoose} onChange={setTheyChoose} />}
              <Toggle label="Gift wrap and printed card" detail={`Red paper, gold seal · ${money(wrapPrice)}`} on={wrap} onChange={setWrap} />
            </section>

            <section aria-label="Total" className="rounded-[20px] bg-white/[0.04] p-4">
              <dl className="flex flex-col gap-1.5 text-[13px] text-ink-2">
                <div className="flex justify-between">
                  <dt>Gift{wrap ? " and wrap" : ""}</dt>
                  <dd className="text-ink">{money(landed.item)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="flex items-center gap-1.5">
                    Shipping and duties to <Flag code={there.code} className="size-4" /> {there.city}
                  </dt>
                  <dd className="text-ink">{money(landed.total - landed.item)}</dd>
                </div>
                <div className="mt-1 flex justify-between border-t border-line pt-2 text-[15px] font-bold text-ink">
                  <dt>You pay</dt>
                  <dd className="font-display">{money(landed.total)}</dd>
                </div>
              </dl>
              <p className="mt-2 flex items-center gap-1.5 text-xs text-positive">
                <Icon name="check" className="size-3.5" />
                {name === "your friend" ? "They pay" : `${name} pays`} nothing at the door
              </p>
            </section>

            <button type="button" onClick={send} className="mb-4 h-[52px] shrink-0 rounded-full bg-accent text-[15px] font-bold">
              Add gift to bag
            </button>
          </>
        )}
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
