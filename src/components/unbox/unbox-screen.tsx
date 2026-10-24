"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/icon";
import { useMoney } from "@/components/price";
import { useStore } from "@/components/providers";
import type { BlindBoxFigure, BlindBoxSeries, Product } from "@/lib/catalog";
import { useStored } from "@/lib/use-stored";

type Case = { number: string; boxes: string[]; taken: number[]; shakes: number };
type Saved = { opened: Record<string, string>; hints: Record<string, string[]>; shakes: number };

const fresh: Saved = { opened: {}, hints: {}, shakes: 0 };

/**
 * An online box machine: pick a sealed box from a real case, shake it for a hint, then open it.
 * Odds are published, a case never repeats a figure, and you can buy the whole case instead.
 */
export function UnboxScreen({ series, product, demo }: { series: BlindBoxSeries; product: Product; demo: Case }) {
  const money = useMoney();
  const { addToCart } = useStore();
  const [stored, setSaved] = useStored<Saved>("app.blindbox", fresh);
  // Drop boxes opened under figure ids this series no longer has.
  const saved = { ...stored, opened: Object.fromEntries(Object.entries(stored.opened).filter(([, id]) => series.figures.some((f) => f.id === id))) };
  const [pick, setPick] = useState<number | null>(null);
  const [shaking, setShaking] = useState(0);
  const [reveal, setReveal] = useState<number | null>(null);
  const [showOdds, setShowOdds] = useState(false);
  const price = product.price ?? 0;
  const figure = (id: string) => series.figures.find((f) => f.id === id)!;
  const regulars = series.figures.filter((f) => !f.secret);
  const owned = new Set(Object.values(saved.opened));
  const left = demo.boxes.length - demo.taken.length - Object.keys(saved.opened).length;
  const shakesLeft = demo.shakes - saved.shakes;
  const hints = pick === null ? [] : (saved.hints[pick] ?? []);

  function shake() {
    if (pick === null || shakesLeft <= 0) return;
    const inside = demo.boxes[pick];
    const ruledOut = regulars.filter((f) => f.id !== inside && !hints.includes(f.id));
    const next = ruledOut[(pick * 7 + hints.length * 3) % ruledOut.length];
    setSaved({ ...saved, shakes: saved.shakes + 1, hints: { ...saved.hints, [pick]: [...hints, next.id] } });
    setShaking((n) => n + 1);
  }

  function open() {
    if (pick === null) return;
    const got = figure(demo.boxes[pick]);
    setSaved({ ...saved, opened: { ...saved.opened, [pick]: got.id } });
    addToCart({ slug: product.slug, title: `${series.title} blind box`, image: got.image, option: got.name, unitPrice: price, qty: 1, note: `Box ${pick + 1}, already opened` });
    setReveal(pick);
    setPick(null);
  }

  function buyCase() {
    addToCart({ slug: product.slug, title: `${series.title} blind box, whole case`, image: series.poster, option: `All ${regulars.length} figures`, unitPrice: price * (regulars.length - 1), qty: 1, note: "Full set guaranteed" });
  }

  return (
    <div className="mx-auto max-w-[760px] px-3.5 pt-safe pb-36 lg:pt-6 lg:pb-16">
      <header className="flex items-center gap-3 pt-2 pb-4 lg:pt-0">
        <Link href="/drops" aria-label="Back to drops" className="glass grid size-11 shrink-0 place-items-center rounded-full">
          <Icon name="back" className="size-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-xl font-bold">{series.title}</h1>
          <p className="text-xs text-ink-2">
            Case #{demo.number} · {left} of {demo.boxes.length} boxes left
          </p>
        </div>
        <button type="button" aria-expanded={showOdds} onClick={() => setShowOdds(!showOdds)} className="glass-inset h-9 rounded-full px-3.5 text-[13px] font-semibold">
          Odds
        </button>
      </header>

      {showOdds && (
        <section aria-label="Odds" className="glass-inset mb-4 rounded-[22px] p-4 text-[13px] text-ink-2 motion-safe:animate-rise">
          <h2 className="mb-1.5 flex items-center gap-1.5 font-bold text-ink">
            <Icon name="shield" className="size-4 text-positive" />
            Published odds
          </h2>
          <p>
            Each of the {regulars.length} figures: 1 in {regulars.length}. The secret, {figure(series.figures.find((f) => f.secret)!.id).name}: 1 in {series.secretOdds}.
          </p>
          <p className="mt-1">A sealed case holds every figure once, so boxes from the same case never repeat. When a secret is in a case, it replaces one figure.</p>
        </section>
      )}

      <section aria-label="Pick a box" className="relative overflow-hidden rounded-[32px] bg-[radial-gradient(120%_80%_at_50%_0%,#3b2a63_0%,#16121f_70%)] p-4 ring-1 ring-white/10">
        <p className="mb-3 text-center text-xs font-semibold text-white/70">Tap a box. Shake it for a free hint, then open it.</p>
        <ul className="grid grid-cols-4 gap-2.5">
          {demo.boxes.map((id, i) => {
            const mine = saved.opened[i];
            const taken = demo.taken.includes(i);
            const selected = pick === i;
            return (
              <li key={i}>
                <button
                  key={selected ? `s${shaking}` : "idle"}
                  type="button"
                  disabled={taken || !!mine}
                  aria-pressed={selected}
                  aria-label={mine ? `Box ${i + 1}: you opened ${figure(mine).name}` : taken ? `Box ${i + 1}: taken` : `Box ${i + 1}`}
                  onClick={() => setPick(selected ? null : i)}
                  className={`relative flex aspect-[3/4] w-full flex-col items-center justify-center overflow-hidden rounded-[16px] transition-transform duration-300 ease-spring ${selected ? "-translate-y-1.5 scale-105 ring-2 ring-save" : ""} ${selected && shaking ? "motion-safe:animate-shake" : ""} ${taken ? "opacity-35" : ""}`}
                >
                  {mine ? (
                    <>
                      <Image src={figure(mine).image} alt="" fill sizes="120px" className="object-cover" />
                      <span className="absolute right-1 bottom-1 grid size-5 place-items-center rounded-full bg-positive text-black">
                        <Icon name="check" className="size-3" strokeWidth={3} />
                      </span>
                    </>
                  ) : (
                    <Sealed number={i + 1} taken={taken} />
                  )}
                </button>
              </li>
            );
          })}
        </ul>

        {pick !== null && (
          <div className="glass mt-4 rounded-[24px] p-3.5 motion-safe:animate-rise">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-display text-lg font-bold">Box {pick + 1}</h2>
              <span className="text-xs text-ink-2">
                {shakesLeft} free {shakesLeft === 1 ? "shake" : "shakes"} left
              </span>
            </div>
            {hints.length > 0 ? (
              <ul className="mt-1.5 flex flex-wrap gap-1.5">
                {hints.map((h) => (
                  <li key={h} className="flex items-center gap-1 rounded-full bg-like/15 px-2 py-1 text-xs font-semibold text-like">
                    <Icon name="close" className="size-3" strokeWidth={2.6} />
                    Not {figure(h).name}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-0.5 text-xs text-ink-2">Shaking tells you one figure it isn&apos;t.</p>
            )}
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={shake} disabled={shakesLeft <= 0} className="glass-inset flex h-11 items-center gap-1.5 rounded-full px-4 text-[13px] font-bold disabled:opacity-40">
                <Icon name="cube" className="size-4" />
                Shake
              </button>
              <button type="button" onClick={open} className="h-11 flex-1 rounded-full bg-accent text-[14px] font-bold">
                Buy and open · {money(price)}
              </button>
            </div>
          </div>
        )}
      </section>

      <button type="button" onClick={buyCase} className="glass mt-3 flex w-full items-center gap-3 rounded-[22px] p-3.5 text-left">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-save/15 text-save">
          <Icon name="gift" className="size-5" />
        </span>
        <span className="min-w-0 flex-1">
          <b className="block text-sm font-semibold">Buy the whole case</b>
          <span className="block text-xs text-ink-2">
            All {regulars.length} figures, no repeats, for the price of {regulars.length - 1}
          </span>
        </span>
        <b className="font-display text-sm font-bold">{money(price * (regulars.length - 1))}</b>
      </button>

      <section aria-labelledby="shelf-h" className="mt-6">
        <h2 id="shelf-h" className="mb-1 px-1 text-[15px] font-bold">
          Your shelf
        </h2>
        <p className="mb-3 px-1 text-xs text-ink-2">
          {regulars.filter((f) => owned.has(f.id)).length} of {regulars.length} found{owned.has(series.figures.find((f) => f.secret)!.id) ? " · secret found!" : ""}
        </p>
        <ul className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {series.figures.map((f) => {
            const have = owned.has(f.id);
            return (
              <li key={f.id} className="flex flex-col items-center gap-1 text-center">
                <span className={`relative block aspect-square w-full overflow-hidden rounded-2xl ${f.secret ? "ring-1 ring-save/50" : ""} ${have ? "" : "bg-white/[0.04]"}`}>
                  {have || !f.secret ? <Image src={f.image} alt="" fill sizes="100px" className={`object-cover ${have ? "" : "opacity-25 grayscale"}`} /> : <span className="grid size-full place-items-center font-display text-2xl font-black text-save/70">?</span>}
                </span>
                <span className={`text-[10.5px] leading-tight font-semibold ${have ? "" : "text-ink-3"}`}>{f.secret && !have ? "Secret" : f.name}</span>
              </li>
            );
          })}
        </ul>
      </section>

      {reveal !== null && <Reveal figure={figure(demo.boxes[reveal])} number={reveal + 1} odds={figure(demo.boxes[reveal]).secret ? `1 in ${series.secretOdds}` : `1 in ${regulars.length}`} onClose={() => setReveal(null)} />}
    </div>
  );
}

function Sealed({ number, taken }: { number: number; taken: boolean }) {
  return (
    <>
      <span aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(160deg,#ff7a52_0%,#cc3a17_45%,#5b1d0d_100%)]" />
      <span aria-hidden="true" className="absolute inset-x-0 top-[22%] h-2 bg-black/20" />
      <span aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(115deg,transparent_35%,rgb(255_255_255/0.28)_50%,transparent_65%)]" />
      <span className="relative font-display text-[28px] leading-none font-black text-white/90">?</span>
      <span className="relative mt-1 text-[10px] font-bold tracking-[0.08em] text-white/75">{taken ? "TAKEN" : `NO. ${String(number).padStart(2, "0")}`}</span>
    </>
  );
}

/** The opening: the box shakes, the lid flies, light spins, and the figure rises. */
function Reveal({ figure, number, odds, onClose }: { figure: BlindBoxFigure; number: number; odds: string; onClose: () => void }) {
  const [stage, setStage] = useState<"shake" | "lid" | "figure">("shake");

  useEffect(() => {
    const a = setTimeout(() => setStage("lid"), 1000);
    const b = setTimeout(() => setStage("figure"), 1550);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, []);

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`You got ${figure.name}`} className="fixed inset-0 z-[80] grid place-items-center bg-black/80 px-6 backdrop-blur-xl">
      {stage === "figure" && (
        <span
          aria-hidden="true"
          className={`pointer-events-none absolute size-[640px] rounded-full opacity-60 motion-safe:animate-rays ${figure.secret ? "bg-[repeating-conic-gradient(from_0deg,#ffc53d_0deg_8deg,transparent_8deg_24deg)]" : "bg-[repeating-conic-gradient(from_0deg,rgb(255_255_255/0.22)_0deg_8deg,transparent_8deg_24deg)]"} [mask-image:radial-gradient(circle,black_10%,transparent_65%)]`}
        />
      )}
      <div className="relative flex w-full max-w-[320px] flex-col items-center text-center">
        {stage !== "figure" ? (
          <div className={`relative aspect-[3/4] w-[200px] ${stage === "shake" ? "motion-safe:animate-shake" : ""}`}>
            <div className="absolute inset-0 overflow-hidden rounded-[26px]">
              <Sealed number={number} taken={false} />
            </div>
            <div className={`absolute inset-x-[-6px] top-[-8px] h-[26%] rounded-[18px] bg-[linear-gradient(160deg,#ff9a76,#cc3a17)] shadow-[0_8px_20px_rgb(0_0_0/0.35)] ${stage === "lid" ? "motion-safe:animate-lid" : ""}`} />
          </div>
        ) : (
          <>
            <p className={`text-xs font-extrabold tracking-[0.16em] motion-safe:animate-rise ${figure.secret ? "text-save" : "text-white/70"}`}>{figure.secret ? "SECRET FIGURE!" : `BOX ${number}`}</p>
            <div className={`relative mt-3 aspect-square w-[240px] overflow-hidden rounded-[32px] shadow-[0_30px_80px_rgb(0_0_0/0.6)] motion-safe:animate-reveal ${figure.secret ? "ring-4 ring-save" : "ring-1 ring-white/20"}`}>
              <Image src={figure.image} alt={figure.name} fill sizes="240px" className="object-cover" />
            </div>
            <h2 className="mt-5 font-display text-[30px] leading-tight font-extrabold tracking-[-0.02em] motion-safe:animate-rise">{figure.name}</h2>
            <p className="text-sm text-ink-2">
              Odds {odds} · added to your shelf
            </p>
            <div className="mt-6 flex w-full flex-col gap-2">
              <button type="button" onClick={onClose} className="h-12 rounded-full bg-white text-[15px] font-bold text-black">
                Open another
              </button>
              <Link href="/checkout" className="flex h-12 items-center justify-center rounded-full bg-white/10 text-[15px] font-semibold">
                Ship it with my bag
              </Link>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
