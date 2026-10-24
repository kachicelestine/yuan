"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useFeedPrefs } from "@/components/feed/feed-prefs";
import { Icon, type IconName } from "@/components/icon";
import { Flag } from "@/components/market/flag";
import { Confetti } from "@/components/motion/confetti";
import { useMoney } from "@/components/price";
import { useStore } from "@/components/providers";
import { brand } from "@/config/brand";
import { categories, products, type CategoryId } from "@/lib/catalog";
import { capDensity } from "@/lib/images";
import { useStored } from "@/lib/use-stored";

type Step = "hello" | "country" | "interests" | "alerts" | "account" | "done";
const order: Step[] = ["hello", "country", "interests", "alerts", "account", "done"];

const alertKinds: { id: string; label: string; detail: string; icon: IconName }[] = [
  { id: "prices", label: "Price drops", detail: "When something you watch gets cheaper", icon: "bell" },
  { id: "drops", label: "Drops and 11.11", detail: "Ten minutes before anything you set a reminder for", icon: "calendar" },
  { id: "live", label: "Lives you follow", detail: "When a seller you follow goes live", icon: "live" },
  { id: "orders", label: "Order updates", detail: "Packed, shipped, in customs, out for delivery", icon: "truck" },
];

const strip = (offset: number) => products.filter((_, i) => i % 3 === offset).slice(0, 8);

/** First run: where you are, what you like, what to tell you about, and a welcome coupon. */
export function WelcomeFlow() {
  const router = useRouter();
  const money = useMoney();
  const { markets, market, setMarket, claimCoupon } = useStore();
  const { prefs, lean } = useFeedPrefs();
  const [step, setStep] = useState<Step>("hello");
  const [alerts, setAlerts] = useStored<string[]>("app.notify", ["orders"]);
  const [, setOnboarded] = useStored<boolean>("app.onboarded", false);
  const at = order.indexOf(step);
  const next = () => setStep(order[at + 1]);
  const back = () => setStep(order[Math.max(0, at - 1)]);

  function toggleInterest(id: CategoryId) {
    lean(id, prefs.more.includes(id) ? null : "more");
  }

  async function allowAlerts() {
    try {
      if ("Notification" in window && Notification.permission === "default") await Notification.requestPermission();
    } catch {
      // Some browsers only allow this from an installed app; the choices are saved either way.
    }
    next();
  }

  /** Keeps the welcome coupon, then signs in and comes back home. */
  function signIn() {
    void claimCoupon("welcome5");
    setOnboarded(true);
    router.push("/signin?next=/");
  }

  function finish() {
    void claimCoupon("welcome5");
    setOnboarded(true);
    setStep("done");
  }

  return (
    <div className="relative mx-auto flex min-h-dvh max-w-[520px] flex-col px-5 pt-safe pb-safe">
      {step !== "hello" && step !== "done" && (
        <header className="flex items-center gap-3 py-3">
          <button type="button" onClick={back} aria-label="Back" className="glass grid size-11 shrink-0 place-items-center rounded-full">
            <Icon name="back" className="size-5" />
          </button>
          <ol aria-label={`Step ${at} of 4`} className="flex flex-1 gap-1.5">
            {[1, 2, 3, 4].map((n) => (
              <li key={n} className={`h-1 flex-1 rounded-full transition-colors duration-500 ${n <= at ? "bg-white" : "bg-white/15"}`} />
            ))}
          </ol>
          <button type="button" onClick={finish} className="h-11 px-2 text-[13px] font-semibold text-ink-2">
            Skip
          </button>
        </header>
      )}

      {step === "hello" && (
        <div className="flex flex-1 flex-col">
          <div aria-hidden="true" className="-mx-5 mt-4 flex flex-col gap-2.5 overflow-hidden [mask-image:linear-gradient(90deg,transparent,#000_15%,#000_85%,transparent)]">
            {[0, 1, 2].map((row) => (
              <div key={row} className={`flex w-max gap-2.5 motion-safe:animate-marquee ${row % 2 ? "[animation-direction:reverse] [animation-duration:38s]" : ""}`}>
                {[...strip(row), ...strip(row)].map((p, i) => (
                  <Image key={`${p.slug}-${i}`} src={p.images[0]} alt="" width={96} height={118} sizes="96px" loading={i < 6 ? "eager" : undefined} className="h-[118px] w-[96px] shrink-0 rounded-[20px] object-cover" />
                ))}
              </div>
            ))}
          </div>
          <div className="mt-auto flex flex-col items-center gap-3 pt-6 pb-4 text-center">
            <span className="seal grid size-14 place-items-center rounded-[18px] bg-accent text-2xl text-white shadow-[0_12px_40px_rgb(204_58_23/0.45)]">{brand.seal}</span>
            <h1 className="font-display text-[30px] leading-[1.05] font-extrabold tracking-[-0.03em] text-balance">
              Everything made in China.
              <br />
              Straight from the source.
            </h1>
            <p className="max-w-[32ch] text-[15px] text-ink-2">Watch it made, ask the maker, and pay the factory price, delivered with duties paid.</p>
            <button type="button" onClick={next} className="mt-3 h-[52px] w-full rounded-full bg-white text-[16px] font-bold text-black">
              Get started
            </button>
            <Link href="/" className="h-11 text-sm leading-[44px] font-semibold text-ink-2">
              Just browse for now
            </Link>
          </div>
        </div>
      )}

      {step === "country" && (
        <section aria-labelledby="w-country" className="flex flex-1 flex-col motion-safe:animate-rise">
          <h1 id="w-country" className="mt-4 font-display text-[30px] leading-tight font-extrabold tracking-[-0.03em]">
            Where should we deliver?
          </h1>
          <p className="mt-1 text-[15px] text-ink-2">Prices show in your currency with shipping and duties included, so the total never surprises you.</p>
          <ul className="no-scrollbar mt-5 -mr-5 grid flex-1 auto-rows-min grid-cols-2 gap-2 overflow-y-auto pr-5 pb-4">
            {markets.map((m) => (
              <li key={m.code}>
                <button
                  type="button"
                  aria-pressed={market.code === m.code}
                  onClick={() => setMarket(m.code)}
                  className={`flex h-14 w-full items-center gap-2.5 rounded-2xl px-3 text-left transition-colors ${market.code === m.code ? "bg-white text-black" : "glass-inset"}`}
                >
                  <Flag code={m.code} className="size-7" />
                  <span className="min-w-0">
                    <span className="block truncate text-[13.5px] font-semibold">{m.name}</span>
                    <span className={`block text-[11px] ${market.code === m.code ? "text-black/60" : "text-ink-3"}`}>{m.currency}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <button type="button" onClick={next} className="mb-4 h-[52px] shrink-0 rounded-full bg-accent text-[15px] font-bold">
            Ship to {market.city}
          </button>
        </section>
      )}

      {step === "interests" && (
        <section aria-labelledby="w-interests" className="flex flex-1 flex-col motion-safe:animate-rise">
          <h1 id="w-interests" className="mt-4 font-display text-[30px] leading-tight font-extrabold tracking-[-0.03em]">
            What are you into?
          </h1>
          <p className="mt-1 text-[15px] text-ink-2">Pick three or more. Your feed starts here, and you can change it any time.</p>
          <ul className="no-scrollbar mt-5 -mr-5 grid flex-1 auto-rows-min grid-cols-3 gap-2 overflow-y-auto pr-5 pb-4">
            {categories.map((c) => {
              const on = prefs.more.includes(c.id);
              return (
                <li key={c.id}>
                  <button type="button" aria-pressed={on} onClick={() => toggleInterest(c.id)} className={`relative block aspect-[4/5] w-full overflow-hidden rounded-[20px] text-left ring-2 transition-[box-shadow,transform] duration-300 ease-spring ${on ? "scale-[0.97] ring-white" : "ring-transparent"}`}>
                    <Image src={c.image} alt="" fill sizes={capDensity("(min-width: 520px) 160px, 33vw")} className="object-cover" />
                    <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
                    <span className="absolute inset-x-2 bottom-2 text-[12.5px] leading-tight font-bold text-legible">{c.label}</span>
                    {on && (
                      <span className="absolute top-2 right-2 grid size-6 place-items-center rounded-full bg-white text-black motion-safe:animate-pop">
                        <Icon name="check" className="size-4" strokeWidth={3} />
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
          <button type="button" onClick={next} disabled={prefs.more.length < 3} className="mb-4 h-[52px] shrink-0 rounded-full bg-accent text-[15px] font-bold disabled:opacity-40">
            {prefs.more.length < 3 ? `Pick ${3 - prefs.more.length} more` : "Continue"}
          </button>
        </section>
      )}

      {step === "alerts" && (
        <section aria-labelledby="w-alerts" className="flex flex-1 flex-col motion-safe:animate-rise">
          <h1 id="w-alerts" className="mt-4 font-display text-[30px] leading-tight font-extrabold tracking-[-0.03em]">
            What should we tell you about?
          </h1>
          <p className="mt-1 text-[15px] text-ink-2">Only these, and never more than twice a day outside your orders.</p>
          <ul className="glass mt-5 flex flex-col divide-y divide-line rounded-[24px]">
            {alertKinds.map((k) => {
              const on = alerts.includes(k.id);
              return (
                <li key={k.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-4 py-3.5">
                    <Icon name={k.icon} className="size-5 text-ink-2" />
                    <span className="min-w-0 flex-1">
                      <b className="block text-[15px] font-semibold">{k.label}</b>
                      <span className="block text-xs text-ink-2">{k.detail}</span>
                    </span>
                    <input type="checkbox" role="switch" checked={on} onChange={() => setAlerts((list) => (list.includes(k.id) ? list.filter((a) => a !== k.id) : [...list, k.id]))} className="peer sr-only" />
                    <span className="relative h-7 w-12 shrink-0 rounded-full bg-white/20 transition-colors peer-checked:bg-positive peer-focus-visible:ring-2 peer-focus-visible:ring-white">
                      <span className={`absolute top-1 left-1 size-5 rounded-full bg-white transition-transform duration-500 ease-spring ${on ? "translate-x-5" : ""}`} />
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
          <div className="mt-auto flex flex-col gap-2 pt-6 pb-4">
            <button type="button" onClick={allowAlerts} className="h-[52px] rounded-full bg-accent text-[15px] font-bold">
              Turn on notifications
            </button>
            <button type="button" onClick={next} className="h-11 text-sm font-semibold text-ink-2">
              Not now
            </button>
          </div>
        </section>
      )}

      {step === "account" && (
        <section aria-labelledby="w-account" className="flex flex-1 flex-col motion-safe:animate-rise">
          <h1 id="w-account" className="mt-4 font-display text-[30px] leading-tight font-extrabold tracking-[-0.03em]">
            Save it all to an account
          </h1>
          <p className="mt-1 text-[15px] text-ink-2">Your bag, coins and orders follow you to any phone. New accounts get {money(5, { nice: true })} off the first order.</p>
          <div className="mt-6 flex flex-col gap-2">
            <button type="button" onClick={() => signIn()} className="flex h-[52px] items-center justify-center gap-2.5 rounded-full bg-white text-[15px] font-semibold text-black">
              <Icon name="send" className="size-5" />
              Continue with email
            </button>
            <button type="button" onClick={() => signIn()} className="glass-inset flex h-[52px] items-center justify-center gap-2.5 rounded-full text-[15px] font-semibold">
              <Icon name="card" className="size-5" />
              Continue with a wallet
            </button>
          </div>
          <button type="button" onClick={finish} className="mt-3 h-11 text-sm font-semibold text-ink-2">
            Stay a guest on this phone
          </button>
          <p className="mt-auto pb-4 text-center text-[11px] text-ink-3">By continuing you agree to the Terms and Privacy Policy. We never sell your data.</p>
        </section>
      )}

      {step === "done" && (
        <section aria-labelledby="w-done" className="flex flex-1 flex-col items-center justify-center gap-3 text-center motion-safe:animate-rise">
          <Confetti />
          <span className="grid size-20 place-items-center rounded-full bg-accent shadow-[0_12px_40px_rgb(204_58_23/0.45)]">
            <Icon name="gift" className="size-9" />
          </span>
          <h1 id="w-done" className="font-display text-[30px] leading-tight font-extrabold tracking-[-0.03em]">
            {money(5, { nice: true })} off is in your wallet
          </h1>
          <p className="max-w-[30ch] text-[15px] text-ink-2">It applies itself at checkout. Your feed is tuned to {prefs.more.length ? `${prefs.more.length} topics` : "what's popular"} and priced for {market.name}.</p>
          <button type="button" onClick={() => router.push("/")} className="mt-4 h-[52px] w-full max-w-xs rounded-full bg-white text-[15px] font-bold text-black">
            Start watching
          </button>
        </section>
      )}
    </div>
  );
}
