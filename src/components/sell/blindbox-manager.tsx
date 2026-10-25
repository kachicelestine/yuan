"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Icon } from "@/components/icon";
import { uploadFile } from "@/lib/upload";
import type { SellerSeriesView } from "@/modules/engagement";
import { createBoxSeriesAction, setBoxSeriesActiveAction } from "@/server/actions/blindboxes";
import { startPhotoAction } from "@/server/actions/shop";

type Listing = { slug: string; title: string; image: string; price: number | null };
type Draft = { name: string; image: string; secret: boolean };

const field = "glass-inset h-11 rounded-2xl px-3 text-[15px] font-normal text-ink outline-none";
const label = "flex flex-col gap-1 text-xs font-semibold text-ink-2";

/** A shop's blind-box series: sell a listing one sealed box at a time, with published odds. */
export function BlindBoxManager({ series, listings, owner }: { series: SellerSeriesView[]; listings: Listing[]; owner: boolean }) {
  const router = useRouter();
  const priced = listings.filter((l) => l.price !== null);
  const info = new Map(listings.map((l) => [l.slug, l]));
  const [adding, setAdding] = useState(false);
  const [slug, setSlug] = useState(priced[0]?.slug ?? "");
  const [title, setTitle] = useState("");
  const [figures, setFigures] = useState<Draft[]>([]);
  const [odds, setOdds] = useState("144");
  const [shakes, setShakes] = useState("3");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const regulars = figures.filter((f) => !f.secret).length;

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    setUploading(true);
    for (const file of [...files].slice(0, 25 - figures.length)) {
      const ticket = await startPhotoAction("catalog", { contentType: file.type, bytes: file.size });
      if (!ticket.ok) {
        setError(ticket.message);
        break;
      }
      try {
        await uploadFile(ticket.url, ticket.headers, file, () => {});
        setFigures((list) => [...list, { name: file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").slice(0, 40), image: ticket.photo, secret: false }]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "The upload didn't finish.");
        break;
      }
    }
    setUploading(false);
  }

  const edit = (i: number, patch: Partial<Draft>) => setFigures((list) => list.map((f, j) => (j === i ? { ...f, ...patch } : patch.secret ? { ...f, secret: false } : f)));

  function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await createBoxSeriesAction({ slug, title, figures, secretOdds: Number(odds) || 0, shakesPerCase: Number(shakes) || 0 });
      if (!r.ok) return setError(r.message);
      setAdding(false);
      setTitle("");
      setFigures([]);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-2">
      {series.length === 0 && !adding && <p className="glass-inset rounded-[22px] p-4 text-sm text-ink-2">Sell a listing as blind boxes: each case holds every figure once, buyers pick a sealed box and open it after paying. You send whichever figure we tell you.</p>}
      <ul className="flex flex-col gap-2">
        {series.map((s) => (
          <li key={s.id} className="glass flex items-center gap-3 rounded-[22px] p-3">
            {s.poster && <Image src={s.poster} alt="" width={48} height={48} sizes="48px" className="size-12 rounded-xl object-cover" />}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">
                {s.title} <span className="text-ink-3">· {info.get(s.slug)?.title ?? s.slug}</span>
              </p>
              <p className="text-xs text-ink-2">
                {s.figures.filter((f) => !f.secret).length} figures{s.figures.some((f) => f.secret) ? ` + secret (1 in ${s.secretOdds})` : ""} · {s.sold} sold from {s.cases} {s.cases === 1 ? "case" : "cases"}
              </p>
            </div>
            <Link href={`/unbox/${s.id}`} aria-label="Open the box machine" className="glass-inset grid size-9 shrink-0 place-items-center rounded-full">
              <Icon name="cube" className="size-4" />
            </Link>
            {owner && (
              <button
                type="button"
                disabled={busy}
                onClick={() =>
                  start(async () => {
                    const r = await setBoxSeriesActiveAction(s.id, !s.active);
                    if (!r.ok) setError(r.message);
                    router.refresh();
                  })
                }
                className={`h-9 shrink-0 rounded-full px-3.5 text-xs font-semibold ${s.active ? "glass-inset" : "bg-white text-black"}`}
              >
                {s.active ? "Pause" : "Resume"}
              </button>
            )}
          </li>
        ))}
      </ul>
      {error && !adding && (
        <p role="alert" className="text-[13px] text-like">
          {error}
        </p>
      )}
      {owner && !adding && priced.length > 0 && (
        <button type="button" onClick={() => setAdding(true)} className="glass-inset h-11 rounded-full text-sm font-semibold">
          New blind-box series
        </button>
      )}
      {adding && (
        <form onSubmit={create} className="glass flex flex-col gap-2.5 rounded-[24px] p-4">
          <label className={label}>
            Listing (the price of one box)
            <select value={slug} onChange={(e) => setSlug(e.target.value)} className={field}>
              {priced.map((l) => (
                <option key={l.slug} value={l.slug} className="bg-raised">
                  {l.title} (${l.price})
                </option>
              ))}
            </select>
          </label>
          <label className={label}>
            Series name
            <input value={title} maxLength={60} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Night Market" className={field} />
          </label>
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-semibold text-ink-2">Figures ({regulars} regular{figures.some((f) => f.secret) ? " + 1 secret" : ""}; a case holds one of each regular)</p>
            <ul className="flex flex-col gap-1.5">
              {figures.map((f, i) => (
                <li key={f.image} className="glass-inset flex items-center gap-2 rounded-2xl p-1.5 pr-2">
                  <Image src={f.image} alt="" width={40} height={40} sizes="40px" className="size-10 rounded-xl object-cover" />
                  <input aria-label={`Figure ${i + 1} name`} value={f.name} maxLength={40} onChange={(e) => edit(i, { name: e.target.value })} className="h-9 min-w-0 flex-1 bg-transparent text-[15px] outline-none" />
                  <label className="flex items-center gap-1 text-[11px] font-semibold text-ink-2">
                    <input type="checkbox" checked={f.secret} onChange={(e) => edit(i, { secret: e.target.checked })} className="size-4" />
                    Secret
                  </label>
                  <button type="button" aria-label="Remove figure" onClick={() => setFigures((list) => list.filter((_, j) => j !== i))} className="grid size-8 place-items-center rounded-full text-ink-3">
                    <Icon name="close" className="size-4" />
                  </button>
                </li>
              ))}
            </ul>
            <label className="glass-inset flex h-11 cursor-pointer items-center justify-center gap-2 rounded-full text-sm font-semibold">
              <Icon name={uploading ? "clock" : "plus"} className="size-4" />
              {uploading ? "Uploading…" : "Add figure photos"}
              <input type="file" accept="image/*" multiple className="sr-only" disabled={uploading} onChange={(e) => addPhotos(e.target.files)} />
            </label>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {figures.some((f) => f.secret) && (
              <label className={label}>
                Secret: 1 box in
                <input inputMode="numeric" value={odds} onChange={(e) => setOdds(e.target.value.replace(/\D/g, ""))} className={field} />
              </label>
            )}
            <label className={label}>
              Free shakes per case
              <input inputMode="numeric" value={shakes} onChange={(e) => setShakes(e.target.value.replace(/\D/g, "").slice(0, 1))} className={field} />
            </label>
          </div>
          <p className="text-[12px] leading-snug text-ink-2">The odds are shown to buyers. What&apos;s in each box is fixed when a case is made; when one is sold, its order tells you which figure to send, sealed.</p>
          {error && (
            <p role="alert" className="text-[13px] text-like">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <button type="submit" disabled={busy || uploading || !title.trim() || regulars < 2} className="h-11 flex-1 rounded-full bg-accent text-sm font-bold disabled:opacity-50">
              {busy ? "Saving…" : regulars < 2 ? "Add at least 2 figures" : "Start selling boxes"}
            </button>
            <button type="button" onClick={() => setAdding(false)} className="glass-inset h-11 rounded-full px-5 text-sm font-semibold">
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
