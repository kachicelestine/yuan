"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Icon, type IconName } from "@/components/icon";
import { useMoney } from "@/components/price";
import { useStore } from "@/components/providers";
import { brand } from "@/config/brand";
import { checkinRewards, rewardStore } from "@/lib/account";
import { plural } from "@/lib/format";
import type { RewardsView } from "@/modules/engagement";
import { claimMissionAction } from "@/server/actions/rewards";

/** Coins, a daily streak, missions, a rewards store and badges. Coins become real coupons. */
export function RewardsScreen({ progress: initial }: { progress: RewardsView }) {
  const router = useRouter();
  const { coins, checkin, coupons: wallet, account, checkIn, redeem, refreshAccount } = useStore();
  const [progress, setProgress] = useState(initial);
  const [burst, setBurst] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const money = useMoney();
  const level = progress.level;
  const today = checkin.claimedToday ? checkin.streak - 1 : checkin.streak;

  // Coins are worth money, so they live on the account: signed out, these ask you to sign in.
  function claim() {
    if (checkin.claimedToday) return;
    if (!account) return router.push("/signin?next=/rewards");
    start(async () => {
      const earned = await checkIn();
      if (!earned) return;
      setBurst(earned);
      setTimeout(() => setBurst(null), 1400);
    });
  }

  function claimMission(id: string) {
    if (!account) return router.push("/signin?next=/rewards");
    start(async () => {
      const r = await claimMissionAction(id);
      if (!r.ok) return setNotice(r.message);
      setProgress(r.view);
      const earned = progress.missions.find((m) => m.id === id)?.reward ?? 0;
      setBurst(earned);
      setTimeout(() => setBurst(null), 1400);
      // The coin balance lives on the account; resync it on this device.
      await refreshAccount();
    });
  }

  function buy(rewardId: string) {
    if (!account) return router.push("/signin?next=/rewards");
    start(async () => {
      const r = await redeem(rewardId);
      setNotice(r.ok ? null : r.message);
    });
  }

  return (
    <div className="mx-auto max-w-[760px] px-3.5 pt-safe pb-36 lg:px-6 lg:pt-6 lg:pb-16">
      <header className="flex items-center gap-3 pt-2 pb-4 lg:pt-0">
        <Link href="/me" aria-label="Back" className="glass grid size-11 shrink-0 place-items-center rounded-full lg:hidden">
          <Icon name="back" className="size-5" />
        </Link>
        <h1 className="flex-1 font-display text-[30px] font-extrabold tracking-[-0.03em]">Rewards</h1>
        <Link href="/coupons" className="glass flex h-10 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold">
          <Icon name="card" className="size-4" />
          Wallet · {wallet.length}
        </Link>
      </header>

      <section aria-label="Your coins" className="relative overflow-hidden rounded-[30px] bg-[radial-gradient(120%_90%_at_10%_0%,#ffc53d33,transparent_55%),radial-gradient(90%_80%_at_100%_100%,#cc3a1744,transparent_60%)] p-5 ring-1 ring-white/10">
        <p className="text-xs font-bold tracking-[0.1em] text-save">{level.name.toUpperCase()} MEMBER</p>
        <p className="mt-1 flex items-baseline gap-2">
          <span className="font-display text-[48px] leading-none font-extrabold tracking-[-0.03em]" aria-live="polite">
            {coins.toLocaleString("en-US")}
          </span>
          <span className="text-sm font-semibold text-ink-2">coins</span>
        </p>
        <p className="mt-1 text-sm text-ink-2">
          {account ? (
            <>Worth about {money(coins / 100, { nice: true })} in coupons</>
          ) : (
            <>
              <Link href="/signin?next=/rewards" className="font-semibold text-ink underline underline-offset-2">
                Sign in
              </Link>{" "}
              to earn coins and keep them on any phone.
            </>
          )}
        </p>
        {level.next && (
          <div className="mt-4">
            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-gradient-to-r from-save to-accent-light" style={{ width: `${level.progress * 100}%` }} />
            </div>
            <p className="mt-1.5 text-xs text-ink-2">
              Earn {plural(level.next.from - progress.earned, "more coin")} to reach {level.next.name}
            </p>
          </div>
        )}
        {burst !== null && (
          <span aria-hidden="true" className="absolute top-6 right-6 animate-burst font-display text-3xl font-extrabold text-save">
            +{burst}
          </span>
        )}
      </section>

      <section aria-labelledby="checkin-h" className="glass mt-4 rounded-[26px] p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="checkin-h" className="text-[15px] font-bold">
            Daily check-in
          </h2>
          <span className="flex items-center gap-1 text-[13px] font-semibold text-accent-light">
            <Icon name="bolt" filled className="size-4" />
            {plural(checkin.streak, "day")} streak
          </span>
        </div>
        <ol className="grid grid-cols-7 gap-1.5">
          {checkinRewards.map((reward, day) => {
            const done = day < checkin.streak;
            const isToday = day === today;
            return (
              <li
                key={day}
                className={`flex flex-col items-center gap-1 rounded-2xl py-2 text-[11px] font-semibold ${done ? "bg-save/20 text-save" : isToday ? "bg-white/[0.12] text-ink ring-1 ring-save/60" : "bg-white/[0.05] text-ink-3"}`}
              >
                <span className="text-[10px]">Day {day + 1}</span>
                <span className={`grid size-7 place-items-center rounded-full ${day === 6 ? "bg-accent text-white" : done ? "bg-save text-black" : "bg-white/10"}`}>
                  {done ? <Icon name="check" className="size-4" /> : day === 6 ? <Icon name="gift" className="size-4" /> : null}
                </span>
                +{reward}
              </li>
            );
          })}
        </ol>
        <button type="button" onClick={claim} disabled={checkin.claimedToday || busy} className="mt-3 h-12 w-full rounded-full bg-save text-[15px] font-bold text-black transition-opacity disabled:bg-white/10 disabled:text-ink-2">
          {checkin.claimedToday ? "Come back tomorrow for more" : account ? `Check in for +${checkinRewards[Math.min(checkin.streak, 6)]} coins` : "Sign in to start a streak"}
        </button>
      </section>

      <section aria-labelledby="missions-h" className="mt-5">
        <h2 id="missions-h" className="mb-3 px-1 text-[15px] font-bold">
          Missions
        </h2>
        <ul className="glass flex flex-col divide-y divide-line overflow-hidden rounded-[26px]">
          {progress.missions.map((m) => {
            const ready = m.progress >= m.goal && !m.claimed;
            const row = (
              <>
                <span className={`grid size-10 shrink-0 place-items-center rounded-full font-display text-xs font-extrabold ${m.claimed ? "bg-positive/15 text-positive" : "bg-save/15 text-save"}`}>
                  {m.claimed ? <Icon name="check" className="size-4" /> : `+${m.reward}`}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={`block text-sm font-semibold ${m.claimed ? "text-ink-2" : ""}`}>{m.title}</span>
                  <span className="mt-1.5 flex items-center gap-2">
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
                      <span className={`block h-full rounded-full ${m.claimed ? "bg-positive" : "bg-save"}`} style={{ width: `${(m.progress / m.goal) * 100}%` }} />
                    </span>
                    <span className="text-[11px] text-ink-3">
                      {m.progress}/{m.goal}
                    </span>
                  </span>
                </span>
              </>
            );
            return (
              <li key={m.id}>
                {ready ? (
                  <div className="flex items-center gap-3 px-4 py-3.5">
                    {row}
                    <button type="button" onClick={() => claimMission(m.id)} disabled={busy} className="h-9 shrink-0 rounded-full bg-save px-3.5 text-[13px] font-bold text-black disabled:opacity-50">
                      Claim
                    </button>
                  </div>
                ) : (
                  <Link href={m.href} className="flex items-center gap-3 px-4 py-3.5">
                    {row}
                    {!m.claimed && <Icon name="forward" className="size-4 text-ink-3" />}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="store-h" className="mt-5">
        <h2 id="store-h" className="mb-3 px-1 text-[15px] font-bold">
          Spend your coins
        </h2>
        {notice && (
          <p role="status" className="mb-2 px-1 text-[13px] text-ink-2">
            {notice}
          </p>
        )}
        <ul className="grid gap-2.5 sm:grid-cols-3">
          {rewardStore.map((r) => {
            const owned = wallet.includes(r.couponId);
            const short = coins < r.cost;
            return (
              <li key={r.id} className="glass-inset flex flex-col gap-3 rounded-[22px] p-4">
                <span className="flex items-start justify-between gap-2">
                  <span className="text-sm font-semibold">{r.title}</span>
                  <Icon name="card" className="size-5 shrink-0 text-accent-light" />
                </span>
                <button
                  type="button"
                  onClick={() => buy(r.id)}
                  disabled={owned || short || busy}
                  className={`mt-auto h-10 rounded-full text-[13px] font-bold ${owned ? "bg-positive/15 text-positive" : short ? "bg-white/[0.06] text-ink-3" : "bg-white text-black"}`}
                >
                  {owned ? "In your wallet" : `${r.cost.toLocaleString("en-US")} coins`}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section aria-labelledby="badges-h" className="mt-5">
        <h2 id="badges-h" className="mb-3 px-1 text-[15px] font-bold">
          Badges
        </h2>
        <ul className="grid grid-cols-3 gap-2.5">
          {progress.badges.map((b) => (
            <li key={b.id} className={`glass-inset flex flex-col items-center gap-2 rounded-[22px] px-2 py-4 text-center ${b.earned ? "" : "opacity-45"}`}>
              <span className={`grid size-14 place-items-center rounded-full ${b.earned ? "bg-[conic-gradient(from_180deg,#ffc53d,#ff7a52,#ffc53d)] text-black" : "bg-white/10 text-ink-2"}`}>
                <Icon name={b.icon as IconName} className="size-6" />
              </span>
              <span className="text-[13px] leading-tight font-semibold">{b.name}</span>
              <span className="text-[11px] leading-tight text-ink-3">{b.detail}</span>
            </li>
          ))}
        </ul>
      </section>

      <p className="glass-inset mt-5 flex items-center gap-3 rounded-[22px] p-4 text-[13px] text-ink-2">
        <Icon name="users" className="size-6 shrink-0 text-accent-light" />
        <span>
          <b className="font-semibold text-ink">Share what you love on {brand.name}.</b> Orders from your link earn you a commission, and 500 coins on the first one.{" "}
          <Link href="/creator" className="font-semibold text-agent">
            Creator hub
          </Link>
        </span>
      </p>
    </div>
  );
}
