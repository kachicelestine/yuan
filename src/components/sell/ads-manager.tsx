"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Icon } from "@/components/icon";
import type { CampaignView } from "@/modules/ads";
import { createCampaignAction, updateCampaignAction } from "@/server/actions/ads";

type Listing = { slug: string; title: string; image: string; price: number | null };

const usd = (n: number) => `$${n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const ctr = (clicks: number, impressions: number) => (impressions ? `${((clicks / impressions) * 100).toFixed(1)}%` : "–");

/** A shop's sponsored-listing campaigns: start one, pause it, change its bid or budget, see what it did. */
export function AdsManager({ campaigns, listings, balance, owner }: { campaigns: CampaignView[]; listings: Listing[]; balance: number; owner: boolean }) {
  const [creating, setCreating] = useState(campaigns.length === 0);
  const image = new Map(listings.map((l) => [l.slug, l.image]));

  return (
    <div className="flex flex-col gap-3">
      <div className="glass flex items-center gap-3 rounded-[22px] p-4">
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-semibold text-ink-2">Paid from your balance</span>
          <span className="block font-display text-[26px] leading-tight font-extrabold">{usd(balance)}</span>
        </span>
        <span className="max-w-[55%] text-right text-xs text-ink-2">{balance < 1 ? "Ads pause while your balance can't cover a click. Delivered orders add to it." : "Each tap is paid from it, never more than your bid."}</span>
      </div>

      {campaigns.map((c) => (
        <CampaignCard key={c.id} campaign={c} images={c.slugs.map((s) => image.get(s)).filter((s): s is string => !!s)} owner={owner} />
      ))}

      {owner &&
        (creating ? (
          <NewCampaign listings={listings} onCancel={campaigns.length ? () => setCreating(false) : undefined} onDone={() => setCreating(false)} />
        ) : (
          <button type="button" onClick={() => setCreating(true)} className="glass-inset flex h-12 items-center justify-center gap-2 rounded-full text-sm font-bold">
            <Icon name="plus" className="size-4" />
            New campaign
          </button>
        ))}
      <p className="px-1 text-xs text-ink-3">
        Sponsored listings show at the top of searches they match and on their category page, marked “Sponsored”. The highest bid doesn’t always win: listings people tap more often pay less for the same place.
      </p>
    </div>
  );
}

function CampaignCard({ campaign: c, images, owner }: { campaign: CampaignView; images: string[]; owner: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [bid, setBid] = useState(String(c.bid));
  const [budget, setBudget] = useState(String(c.dailyBudget));
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const active = c.status === "active";

  const save = (patch: Parameters<typeof updateCampaignAction>[1]) =>
    start(async () => {
      const r = await updateCampaignAction(c.id, patch);
      if (!r.ok) return setError(r.message);
      setError(null);
      setEditing(false);
      router.refresh();
    });

  return (
    <section aria-label={c.name} className="glass flex flex-col gap-3 rounded-[22px] p-4">
      <div className="flex items-center gap-3">
        <span className="flex shrink-0 -space-x-3">
          {images.slice(0, 3).map((src) => (
            <Image key={src} src={src} alt="" width={40} height={40} sizes="40px" className="size-10 rounded-xl object-cover ring-2 ring-surface" />
          ))}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-bold">{c.name}</span>
          <span className="block text-xs text-ink-2">
            {c.slugs.length} {c.slugs.length === 1 ? "listing" : "listings"} · up to {usd(c.bid)} a tap
          </span>
        </span>
        {owner && (
          <button
            type="button"
            role="switch"
            aria-checked={active}
            aria-label={active ? "Pause campaign" : "Resume campaign"}
            disabled={busy}
            onClick={() => save({ status: active ? "paused" : "active" })}
            className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${active ? "bg-positive" : "bg-white/20"}`}
          >
            <span className={`absolute top-1 size-5 rounded-full bg-white transition-[left] ${active ? "left-6" : "left-1"}`} />
          </button>
        )}
      </div>

      <div>
        <div className="mb-1 flex justify-between text-xs">
          <span className="text-ink-2">Spent today</span>
          <span className="font-semibold">
            {usd(c.today.spend)} <span className="font-normal text-ink-2">of {usd(c.dailyBudget)}</span>
          </span>
        </div>
        <span className="block h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
          <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (c.today.spend / c.dailyBudget) * 100)}%` }} />
        </span>
      </div>

      <dl className="grid grid-cols-4 gap-1.5 text-center">
        {[
          ["Seen", c.total.impressions.toLocaleString("en-US")],
          ["Taps", c.total.clicks.toLocaleString("en-US")],
          ["Tap rate", ctr(c.total.clicks, c.total.impressions)],
          ["Spent", usd(c.total.spend)],
        ].map(([label, value]) => (
          <div key={label} className="glass-inset rounded-2xl px-1 py-2">
            <dt className="text-[10.5px] text-ink-2">{label}</dt>
            <dd className="text-[13px] font-bold">{value}</dd>
          </div>
        ))}
      </dl>

      {owner &&
        (editing ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save({ bid: Number(bid), dailyBudget: Number(budget) });
            }}
            className="flex flex-col gap-2"
          >
            <div className="grid grid-cols-2 gap-2">
              <Money label="Bid per tap" value={bid} onChange={setBid} />
              <Money label="Daily budget" value={budget} onChange={setBudget} />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={busy} className="h-10 flex-1 rounded-full bg-accent text-sm font-bold disabled:opacity-50">
                Save
              </button>
              <button type="button" onClick={() => setEditing(false)} className="glass-inset h-10 flex-1 rounded-full text-sm font-semibold">
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button type="button" onClick={() => setEditing(true)} className="self-start text-xs font-semibold text-agent">
            Change bid or budget
          </button>
        ))}
      {error && (
        <p role="alert" className="text-xs font-semibold text-like">
          {error}
        </p>
      )}
    </section>
  );
}

function NewCampaign({ listings, onCancel, onDone }: { listings: Listing[]; onCancel?: () => void; onDone: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [picked, setPicked] = useState<string[]>([]);
  const [bid, setBid] = useState("0.30");
  const [budget, setBudget] = useState("10");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  const toggle = (slug: string) => setPicked((p) => (p.includes(slug) ? p.filter((s) => s !== slug) : [...p, slug]));
  const submit = () =>
    start(async () => {
      const r = await createCampaignAction({ name: name || "My listings", slugs: picked, bid: Number(bid), dailyBudget: Number(budget) });
      if (!r.ok) return setError(r.message);
      setError(null);
      onDone();
      router.refresh();
    });

  if (!listings.length) return <p className="glass-inset rounded-[22px] p-4 text-sm text-ink-2">Publish a listing first; then you can promote it here.</p>;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="glass flex flex-col gap-3 rounded-[22px] p-4"
    >
      <p className="text-[15px] font-bold">New campaign</p>
      <label className="flex flex-col gap-1 text-xs font-semibold text-ink-2">
        Name
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Winter scarves" maxLength={60} className="glass-inset h-11 rounded-2xl px-4 text-[15px] font-normal text-ink outline-none" />
      </label>
      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1 text-xs font-semibold text-ink-2">Listings to promote ({picked.length})</legend>
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {listings.map((l) => {
            const on = picked.includes(l.slug);
            return (
              <li key={l.slug}>
                <button type="button" aria-pressed={on} onClick={() => toggle(l.slug)} className={`relative block w-full overflow-hidden rounded-2xl ring-2 ${on ? "ring-accent" : "ring-transparent"}`}>
                  <span className="relative block aspect-square">
                    <Image src={l.image} alt="" fill sizes="120px" className={`object-cover ${on ? "" : "opacity-70"}`} />
                  </span>
                  {on && (
                    <span className="absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-full bg-accent">
                      <Icon name="check" className="size-3.5" />
                    </span>
                  )}
                  <span className="block truncate px-1.5 py-1 text-left text-[11px] font-semibold">{l.title}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </fieldset>
      <div className="grid grid-cols-2 gap-2">
        <Money label="Bid per tap" value={bid} onChange={setBid} />
        <Money label="Daily budget" value={budget} onChange={setBudget} />
      </div>
      <p className="text-xs text-ink-3">Most shops bid $0.20–$0.60. You often pay less than your bid: just enough to beat the next ad.</p>
      {error && (
        <p role="alert" className="text-xs font-semibold text-like">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button type="submit" disabled={busy || !picked.length} className="h-11 flex-1 rounded-full bg-accent text-sm font-bold disabled:opacity-40">
          {busy ? "Starting…" : "Start campaign"}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="glass-inset h-11 rounded-full px-5 text-sm font-semibold">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

function Money({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-semibold text-ink-2">
      {label}
      <span className="glass-inset flex h-11 items-center rounded-2xl px-3">
        <span className="text-ink-3">$</span>
        <input value={value} onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))} inputMode="decimal" className="h-full min-w-0 flex-1 bg-transparent pl-1 text-[15px] font-normal text-ink outline-none" />
      </span>
    </label>
  );
}
