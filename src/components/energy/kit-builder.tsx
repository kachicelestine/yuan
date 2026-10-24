"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/icon";
import { useMoney } from "@/components/price";
import { useStore } from "@/components/providers";
import { getProduct, unitPrice } from "@/lib/catalog";
import { kitOutcome, kitParts, profileFor, sizeKit, type Kit } from "@/lib/energy";
import { photo } from "@/lib/images";
import { landedCost } from "@/lib/landed";

const backups = [0, 4, 8, 12];
const parts: { key: keyof Kit; slug: string; why: string }[] = [
  { key: "panels", slug: kitParts.panel.slug, why: "Bifacial panels catch light on both sides" },
  { key: "inverters", slug: kitParts.inverter.slug, why: "Runs solar, battery and grid together" },
  { key: "batteries", slug: kitParts.battery.slug, why: "Covers your evenings and blackouts" },
  { key: "turbine", slug: kitParts.turbine.slug, why: "Keeps charging on calm nights and cloudy days" },
];

/** Size a solar kit from your electricity bill, see payback and CO₂, and buy it as one bundle. */
export function KitBuilder() {
  const money = useMoney();
  const { market, addToCart } = useStore();
  const [billUsd, setBillUsd] = useState(60);
  const [backup, setBackup] = useState(8);
  const [wind, setWind] = useState(false);
  const [overrides, setOverrides] = useState<Partial<Kit>>({});
  const [added, setAdded] = useState(false);
  const { sunHours, tariff } = profileFor(market.code);
  const sized = sizeKit({ monthlyBillUsd: billUsd, market: market.code, backupHours: backup, wind });
  const kit: Kit = { panels: sized.panels, inverters: sized.inverters, batteries: sized.batteries, turbine: sized.turbine, ...overrides };
  const outcome = kitOutcome(kit, market.code, sized.dailyUse);
  const lines = parts.map((p) => ({ ...p, product: getProduct(p.slug)!, qty: kit[p.key] })).filter((l) => l.product);
  const items = lines.reduce((n, l) => n + unitPrice(l.product, l.qty) * l.qty, 0);
  const landed = landedCost(items, 0.05, market);
  const paybackYears = outcome.monthlySaving > 0 ? landed.total / (outcome.monthlySaving * 12) : Infinity;
  const tweaked = Object.keys(overrides).length > 0;

  function setQty(key: keyof Kit, qty: number) {
    setOverrides({ ...overrides, [key]: Math.max(0, qty) });
    setAdded(false);
  }

  function addKit() {
    for (const l of lines) {
      if (l.qty > 0) addToCart({ slug: l.product.slug, title: l.product.title, image: l.product.images[0], unitPrice: unitPrice(l.product, l.qty), qty: l.qty, note: "Solar kit" });
    }
    setAdded(true);
  }

  return (
    <div className="mx-auto max-w-[1000px] px-3.5 pt-safe pb-36 lg:px-6 lg:pt-6 lg:pb-16">
      <header data-tone="dark" className="relative -mx-3.5 overflow-hidden lg:mx-0 lg:rounded-[32px]">
        <span className="relative block aspect-[16/10] max-h-[340px] w-full lg:aspect-[16/6]">
          <Image src={photo("1641959166364-6c9b9898e804", { ar: "16:9" })} alt="" fill loading="eager" fetchPriority="high" sizes="(min-width: 1000px) 950px, 100vw" className="object-cover" />
        </span>
        <span className="absolute inset-0 bg-gradient-to-t from-canvas via-black/30 to-black/30" />
        <Link href="/c/energy" aria-label="Back" className="pt-safe absolute top-3 left-3.5 lg:hidden">
          <span className="glass grid size-11 place-items-center rounded-full">
            <Icon name="back" className="size-5" />
          </span>
        </Link>
        <div className="absolute inset-x-3.5 bottom-4 lg:inset-x-8 lg:bottom-6">
          <p className="flex items-center gap-1.5 text-xs font-bold tracking-[0.1em] text-save">
            <Icon name="sun" className="size-4" />
            SOLAR KIT BUILDER
          </p>
          <h1 className="font-display text-[34px] leading-[1.05] font-extrabold tracking-[-0.03em] text-legible lg:text-[46px]">Cut your power bill. Keep the lights on.</h1>
          <p className="mt-1 text-sm text-white/80">
            Sized for {market.city}: about {sunHours} peak sun hours a day.
          </p>
        </div>
      </header>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_1.15fr] lg:items-start">
        <section aria-label="Your home" className="glass flex flex-col gap-5 rounded-[28px] p-4">
          <div>
            <label htmlFor="bill" className="text-[13px] font-semibold text-ink-2">
              Monthly electricity bill
            </label>
            <p className="font-display text-[34px] leading-tight font-extrabold tracking-[-0.03em]">{money(billUsd, { nice: true })}</p>
            <input
              id="bill"
              type="range"
              min={10}
              max={400}
              step={5}
              value={billUsd}
              onChange={(e) => {
                setBillUsd(Number(e.target.value));
                setOverrides({});
                setAdded(false);
              }}
              aria-valuetext={money(billUsd, { nice: true })}
              className="h-10 w-full cursor-pointer accent-[#ffc53d]"
            />
            <p className="text-xs text-ink-3">
              About {Math.round(sized.dailyUse)} kWh a day at {money(tariff)} per kWh
            </p>
          </div>

          <fieldset>
            <legend className="mb-2 text-[13px] font-semibold text-ink-2">Backup after sunset</legend>
            <div className="grid grid-cols-4 gap-1.5">
              {backups.map((h) => (
                <button
                  key={h}
                  type="button"
                  aria-pressed={backup === h}
                  onClick={() => {
                    setBackup(h);
                    setOverrides({});
                    setAdded(false);
                  }}
                  className={`h-11 rounded-2xl text-sm font-semibold transition-colors ${backup === h ? "bg-white text-black" : "glass-inset"}`}
                >
                  {h === 0 ? "None" : `${h} h`}
                </button>
              ))}
            </div>
          </fieldset>

          <label className="flex cursor-pointer items-center gap-3">
            <span className="flex-1">
              <b className="block text-sm font-semibold">Windy site</b>
              <span className="text-xs text-ink-2">Add a small turbine for nights and cloudy weeks</span>
            </span>
            <input
              type="checkbox"
              role="switch"
              checked={wind}
              onChange={(e) => {
                setWind(e.target.checked);
                setOverrides({});
                setAdded(false);
              }}
              className="peer sr-only"
            />
            <span className="relative h-8 w-[52px] shrink-0 rounded-full bg-white/20 transition-colors peer-checked:bg-accent peer-focus-visible:ring-2 peer-focus-visible:ring-white">
              <span className={`absolute top-1 left-1 size-6 rounded-full bg-white shadow transition-transform duration-500 ease-spring ${wind ? "translate-x-5" : ""}`} />
            </span>
          </label>

          <div className="mt-auto">
            <p className="mb-1.5 flex justify-between text-[13px]">
              <span className="font-semibold">Covers {Math.round(outcome.coverage * 100)}% of your use</span>
              <span className="text-ink-2">{outcome.dailyKwh.toFixed(1)} kWh a day</span>
            </p>
            <div className="h-2.5 overflow-hidden rounded-full bg-positive/15" role="meter" aria-valuenow={Math.round(outcome.coverage * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Share of your electricity covered">
              <div className="h-full rounded-full bg-positive transition-[width] duration-500" style={{ width: `${outcome.coverage * 100}%` }} />
            </div>
          </div>
        </section>

        <section aria-label="Your kit" className="flex flex-col gap-3">
          <dl className="grid grid-cols-3 gap-2">
            {[
              ["Saves", money(outcome.monthlySaving, { nice: true }), "a month"],
              ["Pays back", Number.isFinite(paybackYears) ? paybackYears.toFixed(1) : "—", "years"],
              ["CO₂ avoided", outcome.co2Tonnes.toFixed(1), "tonnes a year"],
            ].map(([k, v, unit]) => (
              <div key={k} className="glass-inset min-w-0 rounded-[20px] px-3 py-3">
                <dt className="text-[11px] font-semibold text-ink-2">{k}</dt>
                <dd>
                  <b className="block truncate font-display text-lg leading-tight font-bold">{v}</b>
                  <span className="block text-[11px] text-ink-3">{unit}</span>
                </dd>
              </div>
            ))}
          </dl>

          <ul className="glass flex flex-col divide-y divide-line overflow-hidden rounded-[26px]">
            {lines.map((l) => (
              <li key={l.key} className={`flex items-center gap-3 p-3 ${l.qty === 0 ? "opacity-50" : ""}`}>
                <Image src={l.product.images[0]} alt="" width={56} height={56} sizes="56px" className="size-14 rounded-2xl object-cover" />
                <Link href={`/p/${l.product.slug}`} className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{l.product.title}</span>
                  <span className="block text-xs leading-snug text-ink-2">{l.why}</span>
                  <span className="block font-display text-sm font-bold">{l.qty === 0 ? `${money(unitPrice(l.product, 1))} each` : money(unitPrice(l.product, l.qty) * l.qty)}</span>
                </Link>
                <div className="glass-inset flex h-9 shrink-0 items-center rounded-full">
                  <button type="button" aria-label={`Fewer ${l.product.title}`} onClick={() => setQty(l.key, l.qty - 1)} className="grid size-9 place-items-center">
                    <Icon name="minus" className="size-4" />
                  </button>
                  <span className="min-w-5 text-center text-sm font-semibold">{l.qty}</span>
                  <button type="button" aria-label={`More ${l.product.title}`} onClick={() => setQty(l.key, l.qty + 1)} className="grid size-9 place-items-center">
                    <Icon name="plus" className="size-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {tweaked && (
            <button type="button" onClick={() => setOverrides({})} className="self-start text-[13px] font-semibold text-agent">
              Back to the recommended kit
            </button>
          )}

          <div className="glass rounded-[26px] p-4">
            <dl className="flex flex-col gap-1.5 text-[13px] text-ink-2">
              <div className="flex justify-between">
                <dt>Kit</dt>
                <dd className="text-ink">{money(landed.item)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Shipping, duty and {market.vatLabel}</dt>
                <dd className="text-ink">{money(landed.total - landed.item)}</dd>
              </div>
              <div className="mt-1 flex justify-between border-t border-line pt-2 text-[15px] font-bold text-ink">
                <dt>Delivered to {market.city}</dt>
                <dd className="font-display">{money(landed.total)}</dd>
              </div>
            </dl>
            <div className="mt-3 flex gap-2">
              {added ? (
                <Link href="/checkout" className="flex h-12 flex-1 items-center justify-center rounded-full bg-white text-[15px] font-bold text-black">
                  Kit added · Review and pay
                </Link>
              ) : (
                <button type="button" onClick={addKit} className="h-12 flex-1 rounded-full bg-accent text-[15px] font-bold">
                  Add the kit to your bag
                </button>
              )}
              <Link
                href={`/ask?q=${encodeURIComponent(`Power my home through blackouts. My bill is about ${money(billUsd, { nice: true })} a month.`)}`}
                aria-label="Ask your agent to refine it"
                className="glass-inset grid size-12 shrink-0 place-items-center rounded-full"
              >
                <Icon name="sparkle" className="size-5 text-agent" />
              </Link>
            </div>
            <p className="mt-2.5 text-[11px] leading-snug text-ink-3">Estimates for planning. Roof, shade and wiring change the numbers, so a local installer should confirm before you buy.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
