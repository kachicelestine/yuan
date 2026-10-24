"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/icon";
import type { CategoryView, ListingView } from "@/modules/catalog";
import { uploadFile } from "@/lib/upload";
import { saveListingAction, setListingStatusAction, startPhotoAction } from "@/server/actions/shop";

type OptionDraft = { name: string; values: string };
type Draft = {
  title: string;
  categoryId: string;
  images: string[];
  price: string;
  was: string;
  minOrder: string;
  tiers: { min: string; price: string }[];
  options: OptionDraft[];
  highlights: string;
  specs: [string, string][];
  shipsFrom: string;
  leadMin: string;
  leadMax: string;
};

const fromListing = (l: ListingView | null): Draft => ({
  title: l?.title ?? "",
  categoryId: l?.category ?? "",
  images: l?.images ?? [],
  price: l?.price?.toString() ?? "",
  was: l?.was?.toString() ?? "",
  minOrder: String(l?.moq ?? 1),
  tiers: l?.tiers?.map((t) => ({ min: String(t.min), price: String(t.price) })) ?? [],
  options: l?.options?.map((o) => ({ name: o.name, values: o.values.map((v) => v.label).join(", ") })) ?? [],
  highlights: l?.highlights.join("\n") ?? "",
  specs: l?.specs ?? [],
  shipsFrom: l?.shipsFrom ?? "",
  leadMin: String(l?.leadTime.minDays ?? 3),
  leadMax: String(l?.leadTime.maxDays ?? 7),
});

const num = (v: string) => (v.trim() === "" ? null : Number(v.replace(/[^0-9.]/g, "")));

/** Create or edit a listing. Drafts stay private; Publish puts it in the shop, search and the feed's product cards. */
export function ListingEditor({ listing, categories }: { listing: ListingView | null; categories: Pick<CategoryView, "id" | "label">[] }) {
  const router = useRouter();
  const [d, setD] = useState<Draft>(() => fromListing(listing));
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setD((x) => ({ ...x, [key]: value }));

  async function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    for (const file of [...files].slice(0, 9 - d.images.length)) {
      setBusy("photo");
      setProgress(0);
      const ticket = await startPhotoAction("catalog", { contentType: file.type, bytes: file.size });
      if (!ticket.ok) {
        setError(ticket.message);
        break;
      }
      try {
        await uploadFile(ticket.url, ticket.headers, file, setProgress);
        setD((x) => ({ ...x, images: [...x.images, ticket.photo] }));
      } catch (e) {
        setError(e instanceof Error ? e.message : "The upload didn't finish.");
        break;
      }
    }
    setBusy(null);
  }

  async function save(status: "draft" | "active") {
    setError(null);
    setBusy(status);
    const original = new Map((listing?.options ?? []).map((o) => [o.name, o]));
    const r = await saveListingAction(
      {
        title: d.title,
        categoryId: d.categoryId,
        images: d.images,
        price: num(d.price),
        was: num(d.was),
        tiers: d.tiers.flatMap((t) => (num(t.min) && num(t.price) ? [{ min: num(t.min)!, price: num(t.price)! }] : [])),
        minOrder: num(d.minOrder) ?? 1,
        options: d.options
          .filter((o) => o.name.trim() && o.values.trim())
          .map((o) => {
            // Keep the price add-on and sub-line of values that were already there.
            const before = new Map((original.get(o.name)?.values ?? []).map((v) => [v.label, v]));
            return {
              name: o.name,
              values: o.values
                .split(",")
                .map((v) => v.trim())
                .filter(Boolean)
                .map((label) => ({ label, sub: before.get(label)?.sub ?? null, delta: before.get(label)?.delta ?? null })),
            };
          }),
        highlights: d.highlights.split("\n").map((h) => h.trim()).filter(Boolean),
        specs: d.specs.filter(([k, v]) => k.trim() && v.trim()),
        shipsFrom: d.shipsFrom,
        leadMinDays: num(d.leadMin) ?? 1,
        leadMaxDays: num(d.leadMax) ?? num(d.leadMin) ?? 1,
        status,
      },
      listing?.id,
    );
    setBusy(null);
    if (!r.ok) return setError(r.message);
    router.push("/sell");
    router.refresh();
  }

  async function archive(to: "archived" | "draft") {
    if (!listing) return;
    setBusy(to);
    const r = await setListingStatusAction(listing.id, to);
    setBusy(null);
    if (!r.ok) return setError(r.message);
    router.push("/sell");
    router.refresh();
  }

  const input = "glass-inset h-12 w-full rounded-2xl px-4 text-base outline-none placeholder:text-ink-3";

  return (
    <div className="flex flex-col gap-5">
      <section className="glass rounded-[26px] p-4">
        <h2 className="mb-3 text-[17px] font-bold">Photos</h2>
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-5">
          {d.images.map((src, i) => (
            <li key={src} className="relative aspect-square overflow-hidden rounded-2xl bg-surface">
              <Image src={src} alt="" fill sizes="(min-width: 640px) 20vw, 33vw" className="object-cover" />
              {i === 0 && <span className="absolute top-1.5 left-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold">Cover</span>}
              <span className="absolute right-1 bottom-1 flex gap-1">
                {i > 0 && (
                  <button type="button" aria-label="Make cover" onClick={() => set("images", [src, ...d.images.filter((x) => x !== src)])} className="grid size-8 place-items-center rounded-full bg-black/60">
                    <Icon name="star" className="size-4" />
                  </button>
                )}
                <button type="button" aria-label="Remove photo" onClick={() => set("images", d.images.filter((x) => x !== src))} className="grid size-8 place-items-center rounded-full bg-black/60">
                  <Icon name="close" className="size-4" />
                </button>
              </span>
            </li>
          ))}
          {d.images.length < 9 && (
            <li>
              <label className="glass-inset flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl text-xs font-semibold text-ink-2">
                <Icon name={busy === "photo" ? "clock" : "plus"} className="size-6" />
                {busy === "photo" ? `${Math.round(progress * 100)}%` : "Add photos"}
                <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" disabled={busy !== null} onChange={(e) => addPhotos(e.target.files)} />
              </label>
            </li>
          )}
        </ul>
        <p className="mt-2 text-xs text-ink-3">Up to 9. The first is the cover. Daylight, plain background, the real item.</p>
      </section>

      <section className="glass flex flex-col gap-3.5 rounded-[26px] p-4">
        <Field label="Title">
          <input className={input} value={d.title} onChange={(e) => set("title", e.target.value)} maxLength={140} placeholder="What it is, the key spec, the size" />
        </Field>
        <Field label="Category">
          <select className={input} value={d.categoryId} onChange={(e) => set("categoryId", e.target.value)}>
            <option value="">Choose…</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Price (USD)">
            <input className={input} inputMode="decimal" value={d.price} onChange={(e) => set("price", e.target.value)} placeholder="Quote" />
          </Field>
          <Field label="Was (optional)">
            <input className={input} inputMode="decimal" value={d.was} onChange={(e) => set("was", e.target.value)} />
          </Field>
          <Field label="Min. order">
            <input className={input} inputMode="numeric" value={d.minOrder} onChange={(e) => set("minOrder", e.target.value)} />
          </Field>
        </div>
        <p className="-mt-1 text-xs text-ink-3">Leave the price empty for made-to-order items buyers ask you to quote.</p>

        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-ink-2">Volume prices</p>
          {d.tiers.map((t, i) => (
            <div key={i} className="mb-2 flex items-center gap-2">
              <input className={input} inputMode="numeric" value={t.min} placeholder="From qty" onChange={(e) => set("tiers", d.tiers.map((x, j) => (j === i ? { ...x, min: e.target.value } : x)))} />
              <input className={input} inputMode="decimal" value={t.price} placeholder="Price each" onChange={(e) => set("tiers", d.tiers.map((x, j) => (j === i ? { ...x, price: e.target.value } : x)))} />
              <button type="button" aria-label="Remove tier" onClick={() => set("tiers", d.tiers.filter((_, j) => j !== i))} className="glass-inset grid size-12 shrink-0 place-items-center rounded-full">
                <Icon name="close" className="size-4" />
              </button>
            </div>
          ))}
          {d.tiers.length < 6 && (
            <button type="button" onClick={() => set("tiers", [...d.tiers, { min: "", price: "" }])} className="text-[13px] font-semibold text-agent">
              + Add a volume price
            </button>
          )}
        </div>
      </section>

      <section className="glass flex flex-col gap-3.5 rounded-[26px] p-4">
        <h2 className="text-[17px] font-bold">Options</h2>
        {d.options.map((o, i) => (
          <div key={i} className="flex items-start gap-2">
            <input className={`${input} w-32 shrink-0`} value={o.name} placeholder="Size" onChange={(e) => set("options", d.options.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} />
            <input className={input} value={o.values} placeholder="S, M, L, XL" onChange={(e) => set("options", d.options.map((x, j) => (j === i ? { ...x, values: e.target.value } : x)))} />
            <button type="button" aria-label="Remove option" onClick={() => set("options", d.options.filter((_, j) => j !== i))} className="glass-inset grid size-12 shrink-0 place-items-center rounded-full">
              <Icon name="close" className="size-4" />
            </button>
          </div>
        ))}
        {d.options.length < 4 && (
          <button type="button" onClick={() => set("options", [...d.options, { name: "", values: "" }])} className="self-start text-[13px] font-semibold text-agent">
            + Add an option (size, colour, capacity…)
          </button>
        )}
      </section>

      <section className="glass flex flex-col gap-3.5 rounded-[26px] p-4">
        <Field label="Highlights" hint="One per line, short: what buyers check first.">
          <textarea className="glass-inset min-h-24 rounded-2xl p-4 text-base outline-none" value={d.highlights} onChange={(e) => set("highlights", e.target.value)} placeholder={"480 g cotton\nPre-shrunk"} />
        </Field>
        <div>
          <p className="mb-1.5 text-[13px] font-semibold text-ink-2">Specifications</p>
          {d.specs.map(([k, v], i) => (
            <div key={i} className="mb-2 flex items-center gap-2">
              <input className={`${input} w-36 shrink-0`} value={k} placeholder="Material" onChange={(e) => set("specs", d.specs.map((x, j) => (j === i ? [e.target.value, x[1]] : x)))} />
              <input className={input} value={v} placeholder="100% cotton" onChange={(e) => set("specs", d.specs.map((x, j) => (j === i ? [x[0], e.target.value] : x)))} />
              <button type="button" aria-label="Remove specification" onClick={() => set("specs", d.specs.filter((_, j) => j !== i))} className="glass-inset grid size-12 shrink-0 place-items-center rounded-full">
                <Icon name="close" className="size-4" />
              </button>
            </div>
          ))}
          <button type="button" onClick={() => set("specs", [...d.specs, ["", ""]])} className="text-[13px] font-semibold text-agent">
            + Add a specification
          </button>
        </div>
      </section>

      <section className="glass flex flex-col gap-3.5 rounded-[26px] p-4">
        <h2 className="text-[17px] font-bold">Shipping</h2>
        <Field label="Ships from (city)">
          <input className={input} value={d.shipsFrom} onChange={(e) => set("shipsFrom", e.target.value)} maxLength={80} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Ready to ship in (days)">
            <input className={input} inputMode="numeric" value={d.leadMin} onChange={(e) => set("leadMin", e.target.value)} />
          </Field>
          <Field label="At most (days)">
            <input className={input} inputMode="numeric" value={d.leadMax} onChange={(e) => set("leadMax", e.target.value)} />
          </Field>
        </div>
      </section>

      {error && (
        <p role="alert" className="text-sm text-like">
          {error}
        </p>
      )}
      <div className="flex flex-col gap-2 sm:flex-row">
        <button type="button" disabled={busy !== null} onClick={() => save("active")} className="h-[52px] flex-1 rounded-full bg-accent text-[15px] font-bold disabled:opacity-50">
          {busy === "active" ? "Publishing…" : listing?.status === "active" ? "Save changes" : "Publish"}
        </button>
        {listing?.status !== "active" && (
          <button type="button" disabled={busy !== null} onClick={() => save("draft")} className="glass-inset h-[52px] rounded-full px-6 text-[15px] font-semibold disabled:opacity-50">
            {busy === "draft" ? "Saving…" : "Save draft"}
          </button>
        )}
        {listing && listing.status !== "archived" && (
          <button type="button" disabled={busy !== null} onClick={() => archive("archived")} className="h-[52px] rounded-full px-6 text-[15px] font-semibold text-ink-2 disabled:opacity-50">
            Archive
          </button>
        )}
        {listing?.status === "archived" && (
          <button type="button" disabled={busy !== null} onClick={() => archive("draft")} className="h-[52px] rounded-full px-6 text-[15px] font-semibold text-ink-2 disabled:opacity-50">
            Restore as draft
          </button>
        )}
      </div>
      {listing?.status === "active" && (
        <Link href={`/p/${listing.slug}`} className="self-center text-[13px] font-semibold text-agent">
          View the live listing
        </Link>
      )}
    </div>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      <span className="text-[13px] font-semibold text-ink-2">{label}</span>
      {children}
      {hint && <span className="text-xs text-ink-3">{hint}</span>}
    </label>
  );
}
