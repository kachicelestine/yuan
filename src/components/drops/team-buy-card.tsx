"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icon";
import { useStore } from "@/components/providers";
import { useMoney } from "@/components/price";
import type { Product, TeamBuy } from "@/lib/catalog";
import { clock } from "@/lib/format";
import { avatar } from "@/lib/images";

const ME = avatar("1589525231707-f2de2428f59c");

export function TeamBuyCard({ product, team }: { product: Product; team: TeamBuy }) {
  const money = useMoney();
  const { addToCart } = useStore();
  const [elapsed, setElapsed] = useState(0);
  const [joined, setJoined] = useState<number | null>(null);
  const [started, setStarted] = useState(false);
  const solo = product.price ?? 0;

  useEffect(() => {
    const t = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(t);
  }, []);

  function addTeamLine() {
    addToCart({ slug: product.slug, title: product.title, image: product.images[0], unitPrice: team.teamPrice, qty: 1, note: "TEAM PRICE · SHIPS WHEN FULL" });
  }

  return (
    <article className="glass flex flex-col gap-4 rounded-[30px] p-4">
      <div className="flex gap-3.5">
        <Link href={`/p/${product.slug}`} className="relative size-24 shrink-0 overflow-hidden rounded-[20px]">
          <Image src={product.images[0]} alt={product.title} fill sizes="96px" className="object-cover" />
        </Link>
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold tracking-[0.1em] text-accent-light">TEAM OF {team.size}</p>
          <h3 className="mt-0.5 text-[15px] leading-tight font-bold">{product.title}</h3>
          <p className="mt-1.5 flex items-baseline gap-2">
            <span className="font-display text-2xl font-extrabold">{money(team.teamPrice)}</span>
            <span className="text-xs text-ink-2">each · {money(solo)} alone</span>
          </p>
        </div>
      </div>

      <ul className="flex flex-col gap-2">
        {team.teams.map((t, i) => {
          const mine = joined === i;
          const members = [t.avatar, ...t.joined, ...(mine ? [ME] : [])];
          const open = Math.max(0, team.size - members.length);
          return (
            <li key={t.leader} className="glass-inset flex items-center gap-3 rounded-[20px] p-2.5">
              <div className="flex">
                {members.map((src, m) => (
                  <Image key={`${src}-${m}`} src={src} alt="" width={34} height={34} sizes="34px" className={`-mr-2 size-[34px] rounded-full object-cover ring-[2.5px] ${m === members.length - 1 && mine ? "ring-positive" : "ring-surface"}`} />
                ))}
                {Array.from({ length: open }, (_, k) => (
                  <span key={k} className="-mr-2 grid size-[34px] place-items-center rounded-full text-save ring-[1.5px] ring-save/60 ring-inset">
                    <Icon name="plus" className="size-3.5" />
                  </span>
                ))}
              </div>
              <div className="min-w-0 flex-1 pl-3">
                <p className="text-[13px] font-bold">
                  {t.leader}&apos;s team · {open === 0 ? "full" : `${members.length} of ${team.size}`}
                </p>
                <p className="text-[11.5px] text-ink-2 tabular-nums">{open === 0 ? "Complete. Ships in 48 h" : `Needs ${open} · ${clock(t.endsInSec - elapsed)} left`}</p>
              </div>
              {mine ? (
                <span className="flex h-10 items-center gap-1 rounded-full bg-positive/15 px-3 text-xs font-extrabold text-positive">
                  <Icon name="check" className="size-4" strokeWidth={2.6} />
                  Joined
                </span>
              ) : (
                <button
                  type="button"
                  disabled={joined !== null}
                  onClick={() => {
                    setJoined(i);
                    addTeamLine();
                  }}
                  className="h-10 rounded-full bg-positive px-4 text-[13px] font-extrabold text-black disabled:opacity-40"
                >
                  Join
                </button>
              )}
            </li>
          );
        })}
      </ul>

      <div className="flex gap-2">
        <button
          type="button"
          disabled={started}
          onClick={() => {
            setStarted(true);
            addTeamLine();
          }}
          className="h-12 flex-1 rounded-full bg-accent text-sm font-bold disabled:bg-white/15"
        >
          {started ? "Your team is open · share the link" : `Start a team at ${money(team.teamPrice)}`}
        </button>
        <Link href={`/p/${product.slug}`} className="glass-inset grid h-12 place-items-center rounded-full px-4 text-sm font-semibold">
          Buy alone
        </Link>
      </div>
      <p className="-mt-1 text-center text-[11.5px] text-ink-2">Not full in 24 hours? You&apos;re refunded automatically.</p>
    </article>
  );
}

