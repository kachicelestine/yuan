"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useTeams } from "@/components/drops/team-buys";
import { Icon } from "@/components/icon";
import { useMoney } from "@/components/price";
import { useStore } from "@/components/providers";
import { brand } from "@/config/brand";
import { clock } from "@/lib/format";
import { useNow } from "@/lib/use-now";
import type { TeamView } from "@/modules/engagement";

type ProductInfo = { slug: string; title: string; image: string; price: number | null };

/** A team buy: who's in, how many more it needs, the clock, and the team price once full. */
export function TeamScreen({ initial, product }: { initial: TeamView; product: ProductInfo }) {
  const money = useMoney();
  const now = useNow(1000);
  const { addToCart } = useStore();
  const teams = useTeams();
  const [team, setTeam] = useState(initial);
  const [copied, setCopied] = useState(false);
  const [bought, setBought] = useState(false);

  useEffect(() => {
    if (team.status !== "open") return;
    const t = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      fetch(`/api/teams/${team.id}`, { cache: "no-store" })
        .then((r) => (r.ok ? (r.json() as Promise<TeamView>) : null))
        .then((v) => v && setTeam(v))
        .catch(() => {});
    }, 5000);
    return () => clearInterval(t);
  }, [team.id, team.status]);

  const left = team.size - team.members.length;
  const msLeft = now === null ? null : new Date(team.endsAt).getTime() - now;
  const status = team.status === "open" && msLeft !== null && msLeft <= 0 ? "expired" : team.status;

  async function invite() {
    const url = `${window.location.origin}/team/${team.id}`;
    const text = `Join my team for ${product.title}: ${money(team.teamPrice)} each when we're ${team.size}, on ${brand.name}.`;
    try {
      if (navigator.share) await navigator.share({ title: brand.name, text, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
      }
    } catch {
      // Dismissed.
    }
  }

  function buy() {
    addToCart({ slug: product.slug, title: product.title, image: product.image, unitPrice: team.teamPrice, qty: 1, note: "TEAM PRICE" });
    setBought(true);
  }

  return (
    <div className="mx-auto max-w-[620px] px-3.5 pt-safe pb-36 lg:pt-6 lg:pb-16">
      <header className="flex items-center gap-3 pt-2 pb-4 lg:pt-0">
        <Link href="/drops" aria-label="Back to drops" className="glass grid size-11 shrink-0 place-items-center rounded-full">
          <Icon name="back" className="size-5" />
        </Link>
        <h1 className="flex-1 font-display text-xl font-bold">Team buy</h1>
        {status === "open" && (
          <span role="timer" aria-label="Time left" className="glass-inset flex h-9 items-center gap-1.5 rounded-full px-3 font-display text-sm font-bold tabular-nums">
            <Icon name="clock" className="size-4 text-ink-2" />
            {msLeft === null ? "--:--:--" : clock(msLeft / 1000)}
          </span>
        )}
      </header>

      <section aria-label={`${team.leaderName}'s team`} className="glass relative overflow-hidden rounded-[32px] p-5 text-center">
        <span aria-hidden="true" className="absolute -top-20 left-1/2 size-[300px] -translate-x-1/2 rounded-full bg-positive/20 blur-[80px]" />
        <p className="relative mb-3 text-[13px] text-ink-2">{team.youAreIn ? "You're in this team" : `${team.leaderName} started a team`}</p>
        <Link href={`/p/${product.slug}`} className="relative mx-auto block size-[150px] overflow-hidden rounded-[28px] shadow-[0_20px_50px_rgb(0_0_0/0.45)]">
          <Image src={product.image} alt="" fill loading="eager" sizes="150px" className="object-cover" />
        </Link>
        <h2 className="relative mt-4 text-[15px] font-semibold">{product.title}</h2>
        <p className="relative mt-1 flex items-baseline justify-center gap-2">
          <b className="font-display text-[44px] leading-none font-black tracking-[-0.03em]">{money(team.teamPrice)}</b>
          {product.price !== null && <s className="text-sm text-ink-3">{money(product.price)}</s>}
        </p>
        <p className="relative mt-1 text-[13px] text-ink-2">
          {status === "open" ? (
            <>
              <b className="text-ink">{left}</b> more {left === 1 ? "person" : "people"} to unlock the team price
            </>
          ) : status === "full" ? (
            <b className="text-positive">Team full: everyone gets {money(team.teamPrice)}.</b>
          ) : (
            <>The team didn&apos;t fill in time. Nobody paid anything.</>
          )}
        </p>

        <ol aria-label={`${team.members.length} of ${team.size} joined`} className="relative mt-5 flex justify-center gap-2">
          {Array.from({ length: team.size }, (_, i) => {
            const who = team.members[i];
            return (
              <li key={i}>
                {who ? (
                  <span title={who} className="grid size-10 place-items-center rounded-full bg-white text-sm font-extrabold text-black">
                    {who[0]?.toUpperCase()}
                  </span>
                ) : (
                  <span className="grid size-10 place-items-center rounded-full border border-dashed border-white/30 text-ink-3">
                    <Icon name="plus" className="size-4" />
                  </span>
                )}
              </li>
            );
          })}
        </ol>

        <div className="relative mt-5 flex flex-col gap-2">
          {status === "full" && team.youAreIn ? (
            bought ? (
              <Link href="/checkout" className="flex h-[52px] items-center justify-center rounded-full bg-white text-[15px] font-bold text-black">
                In your bag · Check out
              </Link>
            ) : (
              <button type="button" onClick={buy} className="h-[52px] rounded-full bg-accent text-[15px] font-bold">
                Buy it for {money(team.teamPrice)}
              </button>
            )
          ) : status === "open" && team.youAreIn ? (
            <button type="button" onClick={invite} className="flex h-[52px] items-center justify-center gap-2 rounded-full bg-white text-[15px] font-bold text-black">
              <Icon name="share" className="size-5" />
              {copied ? "Link copied: send it to friends" : `Invite ${left} ${left === 1 ? "friend" : "friends"}`}
            </button>
          ) : status === "open" ? (
            <button type="button" disabled={teams.busy} onClick={() => teams.join(team.id)} className="flex h-[52px] items-center justify-center gap-2 rounded-full bg-positive text-[15px] font-bold text-black disabled:opacity-60">
              <Icon name="users" className="size-5" />
              Join {team.leaderName}&apos;s team
            </button>
          ) : null}
          {status === "full" && team.youAreIn && team.holdsUntil && (
            <p className="text-xs text-ink-2">The team price holds until {new Date(team.holdsUntil).toLocaleString(undefined, { weekday: "short", hour: "numeric", minute: "2-digit" })}.</p>
          )}
          {teams.error && (
            <p role="alert" className="text-xs font-semibold text-like">
              {teams.error}
            </p>
          )}
        </div>
      </section>

      <section aria-labelledby="rules-h" className="glass-inset mt-4 rounded-[24px] p-4">
        <h2 id="rules-h" className="flex items-center gap-1.5 text-[13px] font-bold">
          <Icon name="shield" className="size-4 text-positive" />
          How team buys work
        </h2>
        <ul className="mt-2 flex flex-col gap-1.5 text-[13px] text-ink-2">
          {[
            `The team needs exactly ${team.size} people. The price and the clock never change.`,
            "Nobody pays to join. When the team is full, each member can buy one at the team price within 48 hours.",
            "If the team doesn't fill in time, it simply closes.",
          ].map((r) => (
            <li key={r} className="flex gap-2">
              <Icon name="check" className="mt-0.5 size-3.5 shrink-0 text-positive" />
              {r}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
