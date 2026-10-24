"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ListingView } from "@/modules/catalog";
import type { ShowKind, ShowView } from "@/modules/live";
import { scheduleShowAction } from "@/server/actions/live";

type Props = { shows: ShowView[]; listings: Pick<ListingView, "slug" | "title" | "images" | "price">[]; cover: string; hostName: string };

const KINDS: { id: ShowKind; label: string }[] = [
  { id: "show", label: "Live show" },
  { id: "tour", label: "Factory tour" },
  { id: "auction", label: "Auction" },
];
const STATUS = { scheduled: "Scheduled", live: "Live now", ended: "Ended" } as const;

/** A shop's lives, and planning a new one: title, kind, when, and the products with live prices. */
export function LiveShows({ shows, listings, cover, hostName }: Props) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<ShowKind>("show");
  const [startsIn, setStartsIn] = useState("0");
  const [host, setHost] = useState(hostName);
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    const slugs = Object.keys(picked);
    const first = listings.find((l) => l.slug === slugs[0]);
    const r = await scheduleShowAction({
      title,
      kind,
      coverUrl: first?.images[0] ?? cover,
      place: "",
      hostName: host,
      startsIn: Math.max(0, Math.round(Number(startsIn) || 0)),
      items: slugs.map((slug) => ({ slug, livePrice: kind === "auction" || !picked[slug] ? null : Number(picked[slug]) })),
    });
    setBusy(false);
    if (!r.ok) return setError(r.message);
    router.push(`/sell/live/${r.show.id}`);
  }

  const input = "glass-inset h-11 min-w-0 rounded-2xl px-3 text-base outline-none placeholder:text-ink-3";

  return (
    <div className="flex flex-col gap-4">
      {shows.length > 0 && (
        <ul className="glass flex flex-col divide-y divide-line overflow-hidden rounded-[24px]">
          {shows.map((s) => (
            <li key={s.id}>
              <Link href={`/sell/live/${s.id}`} className="flex items-center gap-3 px-4 py-3">
                <Image src={s.coverUrl} alt="" width={44} height={44} sizes="44px" className="size-11 rounded-xl object-cover" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{s.title}</span>
                  <span className="text-xs text-ink-2">
                    {STATUS[s.status]} · {new Date(s.scheduledFor).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </span>
                {s.status === "live" && <span className="rounded-full bg-live px-2 py-0.5 text-[10px] font-extrabold">LIVE</span>}
              </Link>
            </li>
          ))}
        </ul>
      )}

      <section className="glass flex flex-col gap-3 rounded-[26px] p-4">
        <h2 className="text-[17px] font-bold">Plan a live</h2>
        <input className={input} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={100} placeholder="What you'll show, e.g. Swatching all 12 shades" aria-label="Title" />
        <div className="flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <button key={k.id} type="button" aria-pressed={kind === k.id} onClick={() => setKind(k.id)} className={`h-10 rounded-full px-4 text-sm font-semibold ${kind === k.id ? "bg-white text-black" : "glass-inset text-ink-2"}`}>
              {k.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <label className="flex flex-col gap-1 text-xs text-ink-2">
            Host name
            <input className={input} value={host} onChange={(e) => setHost(e.target.value)} maxLength={40} />
          </label>
          <label className="flex flex-col gap-1 text-xs text-ink-2">
            Starts in (minutes; 0 = now)
            <input className={input} inputMode="numeric" value={startsIn} onChange={(e) => setStartsIn(e.target.value.replace(/\D/g, ""))} />
          </label>
        </div>
        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-ink-2">{kind === "auction" ? "Products you'll auction" : "Products, with an optional live price"}</p>
          <ul className="flex flex-col gap-1.5">
            {listings.map((l) => {
              const on = l.slug in picked;
              return (
                <li key={l.slug} className="flex items-center gap-2.5">
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      setPicked((p) => {
                        const next = { ...p };
                        if (on) delete next[l.slug];
                        else next[l.slug] = "";
                        return next;
                      })
                    }
                    className={`flex min-w-0 flex-1 items-center gap-2.5 rounded-2xl p-1.5 text-left ${on ? "bg-white/10" : ""}`}
                  >
                    <Image src={l.images[0]} alt="" width={36} height={36} sizes="36px" className="size-9 rounded-lg object-cover" />
                    <span className="min-w-0 flex-1 truncate text-sm">{l.title}</span>
                    <span className={`grid size-5 place-items-center rounded-full text-[11px] ${on ? "bg-accent" : "ring-1 ring-white/30"}`}>{on ? "✓" : ""}</span>
                  </button>
                  {on && kind !== "auction" && (
                    <input
                      aria-label={`Live price for ${l.title}`}
                      className={`${input} w-24`}
                      inputMode="decimal"
                      placeholder={l.price !== undefined ? `$${l.price}` : "$"}
                      value={picked[l.slug]}
                      onChange={(e) => setPicked((p) => ({ ...p, [l.slug]: e.target.value.replace(/[^0-9.]/g, "") }))}
                    />
                  )}
                </li>
              );
            })}
          </ul>
          {listings.length === 0 && <p className="text-sm text-ink-2">Publish a listing first.</p>}
        </div>
        {error && (
          <p role="alert" className="text-sm text-like">
            {error}
          </p>
        )}
        <button type="button" disabled={busy || title.trim().length < 3 || !Object.keys(picked).length} onClick={create} className="h-12 rounded-full bg-accent text-[15px] font-bold disabled:opacity-40">
          {busy ? "Setting up…" : Number(startsIn) > 0 ? "Schedule it" : "Set up the studio"}
        </button>
      </section>
    </div>
  );
}
