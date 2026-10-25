"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Icon } from "@/components/icon";
import { useMoney } from "@/components/price";
import { clock } from "@/lib/format";
import { useNow } from "@/lib/use-now";
import type { TeamOfferView, TeamView } from "@/modules/engagement";
import { joinTeamAction, startTeamAction } from "@/server/actions/promos";

type Item = { offer: TeamOfferView; product: { title: string; image: string }; open: TeamView[] };

/** Starts or joins a team, signing in first when needed, and opens it. */
export function useTeams() {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const after = (r: { ok: true; id?: string; team?: TeamView } | { ok: false; code: string; message: string }, id?: string) => {
    if (r.ok) return router.push(`/team/${r.id ?? r.team?.id ?? id}`);
    if (r.code === "sign_in_required") return router.push(`/signin?next=${encodeURIComponent(window.location.pathname)}`);
    setError(r.message);
  };
  return {
    busy,
    error,
    startTeam: (offerId: string) => start(async () => after(await startTeamAction(offerId))),
    join: (teamId: string) => start(async () => after(await joinTeamAction(teamId), teamId)),
  };
}

/** Team buys: the team price unlocks for everyone once the team is full. */
export function TeamBuys({ items }: { items: Item[] }) {
  if (!items.length) return null;
  return (
    <section aria-labelledby="team-buys">
      <h2 id="team-buys" className="font-display text-2xl font-extrabold tracking-[-0.02em]">
        Team buys
      </h2>
      <p className="mb-3 text-sm text-ink-2">Start a team or join one. When it&apos;s full, everyone gets the team price for 48 hours. Not full in time? Nobody pays anything.</p>
      <div className="grid gap-3 lg:grid-cols-2">
        {items.map((item) => (
          <TeamBuyCard key={item.offer.id} {...item} />
        ))}
      </div>
    </section>
  );
}

function TeamBuyCard({ offer, product, open }: Item) {
  const money = useMoney();
  const now = useNow(1000);
  const teams = useTeams();

  return (
    <article className="glass flex flex-col gap-4 rounded-[30px] p-4">
      <div className="flex gap-3.5">
        <Link href={`/p/${offer.slug}`} className="relative size-24 shrink-0 overflow-hidden rounded-[20px]">
          <Image src={product.image} alt={product.title} fill sizes="96px" className="object-cover" />
        </Link>
        <div className="min-w-0">
          <p className="text-[11px] font-extrabold tracking-[0.1em] text-accent-light">TEAM OF {offer.size}</p>
          <h3 className="mt-0.5 text-[15px] leading-tight font-bold">{product.title}</h3>
          <p className="mt-1.5 flex items-baseline gap-2">
            <span className="font-display text-2xl font-extrabold">{money(offer.teamPrice)}</span>
            <span className="text-xs text-ink-2">each · {money(offer.fullPrice)} alone</span>
          </p>
        </div>
      </div>

      {open.length > 0 && (
        <ul className="flex flex-col gap-2">
          {open.map((t) => {
            const left = offer.size - t.members.length;
            return (
              <li key={t.id} className="glass-inset flex items-center gap-3 rounded-[20px] p-2.5">
                <div className="flex">
                  {t.members.map((name, m) => (
                    <span key={m} className="-mr-2 grid size-[34px] place-items-center rounded-full bg-white text-[12px] font-extrabold text-black ring-[2.5px] ring-surface">
                      {name[0]?.toUpperCase()}
                    </span>
                  ))}
                  {Array.from({ length: left }, (_, k) => (
                    <span key={k} className="-mr-2 grid size-[34px] place-items-center rounded-full text-save ring-[1.5px] ring-save/60 ring-inset">
                      <Icon name="plus" className="size-3.5" />
                    </span>
                  ))}
                </div>
                <div className="min-w-0 flex-1 pl-3">
                  <p className="truncate text-[13px] font-bold">
                    {t.leaderName}&apos;s team · {t.members.length} of {offer.size}
                  </p>
                  <p className="text-[11.5px] text-ink-2 tabular-nums">
                    Needs {left}
                    {now !== null && ` · ${clock((new Date(t.endsAt).getTime() - now) / 1000)} left`}
                  </p>
                </div>
                <button type="button" disabled={teams.busy} onClick={() => teams.join(t.id)} className="h-10 rounded-full bg-positive px-4 text-[13px] font-extrabold text-black disabled:opacity-40">
                  Join
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {teams.error && (
        <p role="alert" className="text-xs font-semibold text-like">
          {teams.error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="button" disabled={teams.busy} onClick={() => teams.startTeam(offer.id)} className="h-12 flex-1 rounded-full bg-accent text-sm font-bold disabled:opacity-60">
          Start a team at {money(offer.teamPrice)}
        </button>
        <Link href={`/p/${offer.slug}`} className="glass-inset grid h-12 place-items-center rounded-full px-4 text-sm font-semibold">
          Buy alone
        </Link>
      </div>
      <p className="-mt-1 text-center text-[11.5px] text-ink-2">Teams have {offer.hours} hours to fill. Nobody pays until the team price is unlocked.</p>
    </article>
  );
}
