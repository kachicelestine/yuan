"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Icon } from "@/components/icon";
import type { DropKind, DropView, TeamOfferView } from "@/modules/engagement";
import { cancelDropAction, createTeamOfferAction, scheduleDropAction, setTeamOfferActiveAction } from "@/server/actions/promos";

type Listing = { slug: string; title: string; image: string; price: number | null };

const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const when = (iso: string) => new Date(iso).toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const STATE = { upcoming: "Scheduled", live: "Live now", sold_out: "Sold out", ended: "Ended" } as const;

/** Tomorrow at 20:00 local time, as a datetime-local value. */
function defaultStart() {
  const d = new Date(Date.now() + 86_400_000);
  d.setHours(20, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T20:00`;
}

const field = "glass-inset h-11 rounded-2xl px-3 text-[15px] font-normal text-ink outline-none";
const label = "flex flex-col gap-1 text-xs font-semibold text-ink-2";

/** A shop's drops: schedule one (a drop price with stock, or a restock), see how it went, cancel one. */
export function DropsManager({ drops, listings, owner }: { drops: DropView[]; listings: Listing[]; owner: boolean }) {
  const router = useRouter();
  const priced = listings.filter((l) => l.price !== null);
  const info = new Map(listings.map((l) => [l.slug, l]));
  const [adding, setAdding] = useState(false);
  const [slug, setSlug] = useState(priced[0]?.slug ?? "");
  const [kind, setKind] = useState<DropKind>("drop");
  const [title, setTitle] = useState("");
  const [blurb, setBlurb] = useState("");
  const [startsAt, setStartsAt] = useState(defaultStart);
  const [price, setPrice] = useState("");
  const [stock, setStock] = useState("100");
  const [perPerson, setPerPerson] = useState("1");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const picked = info.get(slug);

  const schedule = () =>
    start(async () => {
      const r = await scheduleDropAction({
        slug,
        kind,
        title: title || `${picked?.title ?? "New"} ${kind === "drop" ? "drop" : "restock"}`,
        blurb,
        startsAt: new Date(startsAt).toISOString(),
        price: kind === "drop" ? Number(price) : null,
        stock: kind === "drop" ? Number(stock) : null,
        perPerson: Number(perPerson),
      });
      if (!r.ok) return setError(r.message);
      setError(null);
      setAdding(false);
      router.refresh();
    });
  const cancel = (id: string) =>
    start(async () => {
      const r = await cancelDropAction(id);
      if (!r.ok) return setError(r.message);
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-3">
      {drops.map((d) => {
        const l = info.get(d.slug);
        return (
          <section key={d.id} aria-label={d.title} className={`glass flex items-center gap-3 rounded-[22px] p-3 ${d.cancelled ? "opacity-50" : ""}`}>
            {l && <Image src={l.image} alt="" width={48} height={48} sizes="48px" className="size-12 shrink-0 rounded-xl object-cover" />}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{d.title}</span>
              <span className="block text-xs text-ink-2">
                {d.cancelled ? "Cancelled" : STATE[d.state]} · {when(d.startsAt)}
              </span>
              <span className="block text-xs text-ink-2">
                {d.price !== null ? `${usd(d.price)} · ${d.claimed}/${d.stock} claimed` : "Restock"} · {d.waiting} waiting
              </span>
            </span>
            {owner && !d.cancelled && d.state === "upcoming" && (
              <button type="button" disabled={busy} onClick={() => cancel(d.id)} className="glass-inset h-9 shrink-0 rounded-full px-3 text-xs font-semibold">
                Cancel
              </button>
            )}
          </section>
        );
      })}

      {owner &&
        (adding ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              schedule();
            }}
            className="glass flex flex-col gap-3 rounded-[22px] p-4"
          >
            <p className="text-[15px] font-bold">Schedule a drop</p>
            <label className={label}>
              Listing
              <select value={slug} onChange={(e) => setSlug(e.target.value)} className={field}>
                {priced.map((l) => (
                  <option key={l.slug} value={l.slug}>
                    {l.title} ({usd(l.price!)})
                  </option>
                ))}
              </select>
            </label>
            <div className="flex gap-1.5" role="radiogroup" aria-label="Kind">
              {(["drop", "restock"] as const).map((k) => (
                <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={`h-9 flex-1 rounded-full text-[13px] font-semibold ${kind === k ? "bg-white text-black" : "glass-inset text-ink-2"}`}>
                  {k === "drop" ? "Drop price" : "Back in stock"}
                </button>
              ))}
            </div>
            <label className={label}>
              Title
              <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="e.g. Ember colourway, 1,200 pairs" className={field} />
            </label>
            <label className={label}>
              What&apos;s special (optional)
              <input value={blurb} onChange={(e) => setBlurb(e.target.value)} maxLength={200} className={field} />
            </label>
            <label className={label}>
              Opens at (your time)
              <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={field} />
            </label>
            {kind === "drop" && (
              <div className="grid grid-cols-3 gap-2">
                <label className={label}>
                  Drop price
                  <input value={price} onChange={(e) => setPrice(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" placeholder={picked?.price ? (picked.price * 0.8).toFixed(2) : ""} className={field} />
                </label>
                <label className={label}>
                  Stock
                  <input value={stock} onChange={(e) => setStock(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" className={field} />
                </label>
                <label className={label}>
                  Per person
                  <input value={perPerson} onChange={(e) => setPerPerson(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" className={field} />
                </label>
              </div>
            )}
            <p className="text-xs text-ink-3">Shoppers who set a reminder hear 10 minutes before. A drop runs 24 hours or until the stock at the drop price is gone.</p>
            {error && (
              <p role="alert" className="text-xs font-semibold text-like">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <button type="submit" disabled={busy || !slug || (kind === "drop" && !Number(price))} className="h-11 flex-1 rounded-full bg-accent text-sm font-bold disabled:opacity-40">
                Schedule it
              </button>
              <button type="button" onClick={() => setAdding(false)} className="glass-inset h-11 rounded-full px-5 text-sm font-semibold">
                Cancel
              </button>
            </div>
          </form>
        ) : priced.length ? (
          <button type="button" onClick={() => setAdding(true)} className="glass-inset flex h-12 items-center justify-center gap-2 rounded-full text-sm font-bold">
            <Icon name="bolt" className="size-4" />
            Schedule a drop
          </button>
        ) : null)}
      {!adding && error && (
        <p role="alert" className="text-xs font-semibold text-like">
          {error}
        </p>
      )}
    </div>
  );
}

/** A shop's team-buy offers: a team price that unlocks when enough people join. */
export function TeamOffersManager({ offers, listings, owner }: { offers: TeamOfferView[]; listings: Listing[]; owner: boolean }) {
  const router = useRouter();
  const priced = listings.filter((l) => l.price !== null);
  const info = new Map(listings.map((l) => [l.slug, l]));
  const [adding, setAdding] = useState(false);
  const [slug, setSlug] = useState(priced[0]?.slug ?? "");
  const [teamPrice, setTeamPrice] = useState("");
  const [size, setSize] = useState(3);
  const [hours, setHours] = useState(24);
  const [teams, setTeams] = useState("50");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const picked = info.get(slug);

  const create = () =>
    start(async () => {
      const r = await createTeamOfferAction({ slug, teamPrice: Number(teamPrice), size, hours, teams: Number(teams) });
      if (!r.ok) return setError(r.message);
      setError(null);
      setAdding(false);
      router.refresh();
    });
  const toggle = (o: TeamOfferView) =>
    start(async () => {
      const r = await setTeamOfferActiveAction(o.id, !o.active);
      if (!r.ok) return setError(r.message);
      router.refresh();
    });

  return (
    <div className="flex flex-col gap-3">
      {offers.map((o) => {
        const l = info.get(o.slug);
        return (
          <section key={o.id} aria-label={l?.title ?? o.slug} className="glass flex items-center gap-3 rounded-[22px] p-3">
            {l && <Image src={l.image} alt="" width={48} height={48} sizes="48px" className="size-12 shrink-0 rounded-xl object-cover" />}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{l?.title ?? o.slug}</span>
              <span className="block text-xs text-ink-2">
                {usd(o.teamPrice)} in teams of {o.size} · {o.hours} h
              </span>
              <span className="block text-xs text-ink-2">
                {o.started ?? 0} started · {o.full ?? 0} filled · {o.remaining} left
              </span>
            </span>
            {owner && (
              <button
                type="button"
                role="switch"
                aria-checked={o.active}
                aria-label={o.active ? "Stop offering" : "Offer again"}
                disabled={busy}
                onClick={() => toggle(o)}
                className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${o.active ? "bg-positive" : "bg-white/20"}`}
              >
                <span className={`absolute top-1 size-5 rounded-full bg-white transition-[left] ${o.active ? "left-6" : "left-1"}`} />
              </button>
            )}
          </section>
        );
      })}

      {owner &&
        (adding ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              create();
            }}
            className="glass flex flex-col gap-3 rounded-[22px] p-4"
          >
            <p className="text-[15px] font-bold">New team buy</p>
            <label className={label}>
              Listing
              <select value={slug} onChange={(e) => setSlug(e.target.value)} className={field}>
                {priced.map((l) => (
                  <option key={l.slug} value={l.slug}>
                    {l.title} ({usd(l.price!)})
                  </option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-2">
              <label className={label}>
                Team price
                <input value={teamPrice} onChange={(e) => setTeamPrice(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" placeholder={picked?.price ? (picked.price * 0.85).toFixed(2) : ""} className={field} />
              </label>
              <label className={label}>
                Teams to offer
                <input value={teams} onChange={(e) => setTeams(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" className={field} />
              </label>
            </div>
            <fieldset className="flex flex-col gap-1.5">
              <legend className="mb-1 text-xs font-semibold text-ink-2">People per team</legend>
              <div className="flex gap-1.5">
                {[2, 3, 5, 10].map((n) => (
                  <button key={n} type="button" aria-pressed={size === n} onClick={() => setSize(n)} className={`h-9 flex-1 rounded-full text-[13px] font-semibold ${size === n ? "bg-white text-black" : "glass-inset text-ink-2"}`}>
                    {n}
                  </button>
                ))}
              </div>
            </fieldset>
            <fieldset className="flex flex-col gap-1.5">
              <legend className="mb-1 text-xs font-semibold text-ink-2">Time to fill</legend>
              <div className="flex gap-1.5">
                {[12, 24, 48].map((h) => (
                  <button key={h} type="button" aria-pressed={hours === h} onClick={() => setHours(h)} className={`h-9 flex-1 rounded-full text-[13px] font-semibold ${hours === h ? "bg-white text-black" : "glass-inset text-ink-2"}`}>
                    {h} h
                  </button>
                ))}
              </div>
            </fieldset>
            <p className="text-xs text-ink-3">Each member of a full team can buy one at the team price within 48 hours. Teams that don&apos;t fill cost you nothing.</p>
            {error && (
              <p role="alert" className="text-xs font-semibold text-like">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <button type="submit" disabled={busy || !slug || !Number(teamPrice)} className="h-11 flex-1 rounded-full bg-accent text-sm font-bold disabled:opacity-40">
                Offer it
              </button>
              <button type="button" onClick={() => setAdding(false)} className="glass-inset h-11 rounded-full px-5 text-sm font-semibold">
                Cancel
              </button>
            </div>
          </form>
        ) : priced.length ? (
          <button type="button" onClick={() => setAdding(true)} className="glass-inset flex h-12 items-center justify-center gap-2 rounded-full text-sm font-bold">
            <Icon name="users" className="size-4" />
            New team buy
          </button>
        ) : null)}
    </div>
  );
}
