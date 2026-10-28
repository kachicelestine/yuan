"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { Icon } from "@/components/icon";
import { useMoney } from "@/components/price";
import { useStore } from "@/components/providers";
import type { MachineView } from "@/modules/engagement";
import { holdCaseAction, openBoxAction, pickBoxAction, shakeBoxAction } from "@/server/actions/blindboxes";

type Figure = MachineView["series"]["figures"][number];

const oneIn = (p: number) => (p > 0 ? `1 in ${Math.round(1 / p)}` : "none");

/**
 * An online box machine: pick a sealed box from a real case, shake it for a hint, buy it,
 * and open it once it's paid for. Odds are published and a case never repeats a figure.
 */
export function UnboxScreen({ initial, price, signedIn }: { initial: MachineView; price: number; signedIn: boolean }) {
  const money = useMoney();
  const { addToCart } = useStore();
  const [m, setM] = useState(initial);
  const [pick, setPick] = useState<number | null>(null);
  const [shaking, setShaking] = useState(0);
  const [reveal, setReveal] = useState<{ figure: Figure; number: number } | null>(null);
  const [showOdds, setShowOdds] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [added, setAdded] = useState<number[]>([]);
  const [wholeCase, setWholeCase] = useState<number | null>(null);
  const [busy, start] = useTransition();
  const figure = (id: string) => m.series.figures.find((f) => f.id === id)!;
  const secret = m.series.figures.find((f) => f.secret);
  const regulars = m.series.figures.filter((f) => !f.secret);
  const found = new Set(m.owned.flatMap((o) => o.figureId ?? []));
  const unopened = m.owned.filter((o) => o.figureId === null);
  const hints = pick === null ? [] : (m.hints[pick] ?? []);
  const slot = pick === null ? null : m.case.slots[pick];

  function shake() {
    if (pick === null) return;
    setError(null);
    start(async () => {
      const r = await shakeBoxAction(m.case.id, pick);
      if (!r.ok) return setError(r.message);
      setM(r.view);
      setShaking((n) => n + 1);
    });
  }

  function hold() {
    if (pick === null) return;
    setError(null);
    start(async () => {
      const r = await pickBoxAction(m.case.id, pick);
      if (!r.ok) return setError(r.message);
      setM(r.view);
      if (!added.includes(pick)) {
        addToCart({ ...r.line, option: undefined, qty: 1 });
        setAdded((a) => [...a, pick]);
      }
    });
  }

  /** A fresh sealed case, every box in it held for this shopper and put in the bag. */
  function buyCase() {
    setError(null);
    start(async () => {
      const r = await holdCaseAction(m.series.id);
      if (!r.ok) return setError(r.message);
      if (wholeCase !== r.caseNumber) addToCart({ ...r.line, option: undefined });
      setWholeCase(r.caseNumber);
    });
  }

  function open(o: MachineView["owned"][number]) {
    setError(null);
    start(async () => {
      const r = await openBoxAction(o.caseId, o.index);
      if (!r.ok) return setError(r.message);
      setM((v) => ({ ...v, owned: v.owned.map((x) => (x.caseId === o.caseId && x.index === o.index ? { ...x, figureId: r.figureId } : x)) }));
      setReveal({ figure: figure(r.figureId), number: o.index + 1 });
    });
  }

  return (
    <div className="mx-auto max-w-[760px] px-3.5 pt-safe pb-36 lg:pt-6 lg:pb-16">
      <header className="flex items-center gap-3 pt-2 pb-4 lg:pt-0">
        <Link href="/drops" aria-label="Back to drops" className="glass grid size-11 shrink-0 place-items-center rounded-full">
          <Icon name="back" className="size-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-xl font-bold">{m.series.title}</h1>
          <p className="text-xs text-ink-2">
            Case #{m.case.number} · {m.case.left} of {m.case.size} boxes left · {money(price)} a box
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
            Published odds, per box
          </h2>
          <p>
            Each of the {regulars.length} figures: about {oneIn(m.series.odds.regular)}.{secret ? ` The secret, ${secret.name}: ${oneIn(m.series.odds.secret)}.` : ""}
          </p>
          <p className="mt-1">A sealed case holds every figure once, so boxes from one case never repeat.{secret ? " When the secret is in a case, it takes one figure's place." : ""} What&apos;s in each box is fixed when the case is made, and you see it only after you&apos;ve paid.</p>
        </section>
      )}

      <section aria-label="Pick a box" className="relative overflow-hidden rounded-[32px] bg-[radial-gradient(120%_80%_at_50%_0%,#3b2a63_0%,#16121f_70%)] p-4 ring-1 ring-white/10">
        <p className="mb-3 text-center text-xs font-semibold text-white/70">Tap a box. Shake it for a free hint, then buy it.</p>
        <ul className="grid grid-cols-4 gap-2.5">
          {m.case.slots.map((state, i) => {
            const selected = pick === i;
            const unavailable = state === "taken" || state === "mine";
            return (
              <li key={i}>
                <button
                  key={selected ? `s${shaking}` : "idle"}
                  type="button"
                  disabled={unavailable}
                  aria-pressed={selected}
                  aria-label={state === "mine" ? `Box ${i + 1}: yours` : state === "taken" ? `Box ${i + 1}: taken` : state === "held" ? `Box ${i + 1}: held for you` : `Box ${i + 1}`}
                  onClick={() => setPick(selected ? null : i)}
                  className={`relative flex aspect-[3/4] w-full flex-col items-center justify-center overflow-hidden rounded-[16px] transition-transform duration-300 ease-spring ${selected ? "-translate-y-1.5 scale-105 ring-2 ring-save" : ""} ${selected && shaking ? "motion-safe:animate-shake" : ""} ${unavailable ? "opacity-35" : ""}`}
                >
                  <Sealed number={i + 1} label={state === "taken" ? "TAKEN" : state === "mine" ? "YOURS" : state === "held" ? "HELD" : null} />
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
                {m.case.shakesLeft} free {m.case.shakesLeft === 1 ? "shake" : "shakes"} left in this case
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
            {error && (
              <p role="alert" className="mt-2 text-xs text-like">
                {error}
              </p>
            )}
            {signedIn ? (
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={shake} disabled={busy || m.case.shakesLeft <= 0} className="glass-inset flex h-11 items-center gap-1.5 rounded-full px-4 text-[13px] font-bold disabled:opacity-40">
                  <Icon name="cube" className="size-4" />
                  Shake
                </button>
                {slot === "held" && added.includes(pick) ? (
                  <Link href="/checkout" className="grid h-11 flex-1 place-items-center rounded-full bg-accent text-[14px] font-bold">
                    In your bag · check out
                  </Link>
                ) : (
                  <button type="button" onClick={hold} disabled={busy} className="h-11 flex-1 rounded-full bg-accent text-[14px] font-bold disabled:opacity-50">
                    {slot === "held" ? "Held for you · add to bag" : `Buy this box · ${money(price)}`}
                  </button>
                )}
              </div>
            ) : (
              <Link href="/signin?next=/unbox" className="mt-3 grid h-11 place-items-center rounded-full bg-accent text-[14px] font-bold">
                Sign in to pick a box
              </Link>
            )}
            {slot === "held" && <p className="mt-2 text-center text-[11px] text-ink-3">We hold it for 30 minutes while you check out. You open it once it&apos;s paid.</p>}
          </div>
        )}
      </section>

      {signedIn && (
        <section aria-label="Whole case" className="glass-inset mt-4 flex items-center gap-3 rounded-[22px] p-3.5">
          <span className="min-w-0 flex-1">
            <b className="block text-sm font-semibold">Want the set? Buy a whole case</b>
            <span className="block text-xs text-ink-2">
              {m.case.size} sealed boxes, each regular figure once{secret ? " (unless the secret takes one's place)" : ""} · {money(price * m.case.size)}
            </span>
          </span>
          {wholeCase !== null ? (
            <Link href="/checkout" className="grid h-10 shrink-0 place-items-center rounded-full bg-accent px-4 text-[13px] font-bold">
              Case #{wholeCase} · check out
            </Link>
          ) : (
            <button type="button" onClick={buyCase} disabled={busy} className="h-10 shrink-0 rounded-full bg-white px-4 text-[13px] font-bold text-black disabled:opacity-50">
              Buy case
            </button>
          )}
        </section>
      )}

      {unopened.length > 0 && (
        <section aria-labelledby="open-h" className="glass mt-4 rounded-[26px] p-4">
          <h2 id="open-h" className="text-[15px] font-bold">
            Ready to open
          </h2>
          <p className="mb-3 text-xs text-ink-2">Paid for, still sealed. The shop sends whatever&apos;s inside.</p>
          <ul className="grid grid-cols-4 gap-2.5">
            {unopened.map((o) => (
              <li key={`${o.caseId}-${o.index}`}>
                <button type="button" disabled={busy} onClick={() => open(o)} aria-label={`Open box ${o.index + 1} from case ${o.caseNumber}`} className="relative flex aspect-[3/4] w-full flex-col items-center justify-center overflow-hidden rounded-[16px] motion-safe:animate-breathe">
                  <Sealed number={o.index + 1} label="OPEN" />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="shelf-h" className="mt-6">
        <h2 id="shelf-h" className="mb-1 px-1 text-[15px] font-bold">
          Your shelf
        </h2>
        <p className="mb-3 px-1 text-xs text-ink-2">
          {regulars.filter((f) => found.has(f.id)).length} of {regulars.length} found{secret && found.has(secret.id) ? " · secret found!" : ""}
        </p>
        <ul className="grid grid-cols-4 gap-2 sm:grid-cols-7">
          {m.series.figures.map((f) => {
            const have = found.has(f.id);
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

      {reveal && <Reveal figure={reveal.figure} number={reveal.number} odds={reveal.figure.secret ? oneIn(m.series.odds.secret) : `about ${oneIn(m.series.odds.regular)}`} onClose={() => setReveal(null)} />}
    </div>
  );
}

function Sealed({ number, label }: { number: number; label: string | null }) {
  return (
    <>
      <span aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(160deg,#ff7a52_0%,#cc3a17_45%,#5b1d0d_100%)]" />
      <span aria-hidden="true" className="absolute inset-x-0 top-[22%] h-2 bg-black/20" />
      <span aria-hidden="true" className="absolute inset-0 bg-[linear-gradient(115deg,transparent_35%,rgb(255_255_255/0.28)_50%,transparent_65%)]" />
      <span className="relative font-display text-[28px] leading-none font-black text-white/90">?</span>
      <span className="relative mt-1 text-[10px] font-bold tracking-[0.08em] text-white/75">{label ?? `NO. ${String(number).padStart(2, "0")}`}</span>
    </>
  );
}

/** The opening: the box shakes, the lid flies, light spins, and the figure rises. */
function Reveal({ figure, number, odds, onClose }: { figure: Figure; number: number; odds: string; onClose: () => void }) {
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
              <Sealed number={number} label={null} />
            </div>
            <div className={`absolute inset-x-[-6px] top-[-8px] h-[26%] rounded-[18px] bg-[linear-gradient(160deg,#ff9a76,#cc3a17)] shadow-[0_8px_20px_rgb(0_0_0/0.35)] ${stage === "lid" ? "motion-safe:animate-lid" : ""}`} />
          </div>
        ) : (
          <>
            <p className={`text-xs font-extrabold tracking-[0.16em] motion-safe:animate-rise ${figure.secret ? "text-save" : "text-white/70"}`}>{figure.secret ? "SECRET FIGURE!" : `BOX ${number}`}</p>
            <div className={`relative mt-3 aspect-square w-[240px] overflow-hidden rounded-[32px] shadow-[0_30px_80px_rgb(0_0_0/0.6)] motion-safe:animate-reveal ${figure.secret ? "ring-4 ring-save" : "ring-1 ring-white/20"}`}>
              <Image src={figure.image} alt={figure.name} fill priority sizes="240px" className="object-cover" />
            </div>
            <h2 className="mt-5 font-display text-[30px] leading-tight font-extrabold tracking-[-0.02em] motion-safe:animate-rise">{figure.name}</h2>
            <p className="text-sm text-ink-2">Odds {odds} · on its way with your order</p>
            <button type="button" onClick={onClose} className="mt-6 h-12 w-full rounded-full bg-white text-[15px] font-bold text-black">
              Back to the shelf
            </button>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
