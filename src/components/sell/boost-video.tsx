"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Icon } from "@/components/icon";
import { boostVideoAction } from "@/server/actions/ads";

type Video = { id: string; image: string; caption: string; views: number; boosted: boolean };

/** Pick one of the videos showing your products and boost it into For You, paid per tap. */
export function BoostVideo({ videos, owner }: { videos: Video[]; owner: boolean }) {
  const router = useRouter();
  const [picked, setPicked] = useState<string | null>(null);
  const [bid, setBid] = useState("0.30");
  const [budget, setBudget] = useState("10");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!videos.length) return <p className="glass-inset rounded-[22px] p-4 text-sm text-ink-2">No published videos of your products yet. Post one, or ask creators to (free samples help).</p>;
  const n = (s: string) => Number(s.replace(/[^0-9.]/g, "")) || 0;
  const field = "glass-inset h-11 w-full rounded-2xl px-3.5 text-sm outline-none";

  return (
    <div className="flex flex-col gap-3">
      <ul className="no-scrollbar -mx-3.5 flex gap-2 overflow-x-auto px-3.5 lg:mx-0 lg:px-0" aria-label="Your videos">
        {videos.map((v) => (
          <li key={v.id} className="w-[104px] shrink-0">
            <button
              type="button"
              disabled={!owner || v.boosted}
              onClick={() => setPicked(v.id === picked ? null : v.id)}
              aria-pressed={picked === v.id}
              aria-label={v.caption}
              className={`relative block aspect-[9/16] w-full overflow-hidden rounded-2xl bg-surface ring-2 transition ${picked === v.id ? "ring-accent" : "ring-transparent"} disabled:opacity-60`}
            >
              {v.image && <Image src={v.image} alt="" fill sizes="104px" className="object-cover" />}
              <span className="absolute inset-x-1.5 bottom-1.5 flex items-center gap-1 text-[11px] font-semibold text-white drop-shadow">
                <Icon name="play" filled className="size-3" />
                {v.views.toLocaleString()}
              </span>
              {v.boosted && <span className="absolute top-1.5 left-1.5 rounded-full bg-accent px-1.5 py-0.5 text-[10px] font-bold text-white">Boosted</span>}
              {picked === v.id && (
                <span className="absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-full bg-accent text-white">
                  <Icon name="check" className="size-3.5" />
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
      {owner && picked && (
        <form
          className="glass flex flex-col gap-3 rounded-[22px] p-4"
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            start(async () => {
              const r = await boostVideoAction({ videoId: picked, bid: n(bid), dailyBudget: n(budget) });
              if (!r.ok) return setError(r.message);
              setPicked(null);
              router.refresh();
            });
          }}
        >
          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-[11px] font-semibold text-ink-2">
              Most per tap ($)
              <input inputMode="decimal" value={bid} onChange={(e) => setBid(e.target.value)} className={field} />
            </label>
            <label className="flex flex-col gap-1 text-[11px] font-semibold text-ink-2">
              Daily budget ($)
              <input inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} className={field} />
            </label>
          </div>
          {error && (
            <p role="alert" className="text-sm text-like">
              {error}
            </p>
          )}
          <button type="submit" disabled={pending} className="h-11 rounded-full bg-accent text-sm font-bold text-white disabled:opacity-50">
            {pending ? "Boosting…" : "Boost this video"}
          </button>
        </form>
      )}
      <p className="px-1 text-xs text-ink-3">Boosted videos appear in For You as a sponsored slide, about one in every six. You pay when someone opens the video&apos;s shop sheet, never more than your bid; pause it any time above.</p>
    </div>
  );
}
