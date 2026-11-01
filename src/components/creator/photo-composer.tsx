"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { useMoney } from "@/components/price";
import { useProductSearch } from "@/components/search/use-product-search";
import type { Product } from "@/lib/catalog";
import { uploadFile } from "@/lib/upload";
import { postNoteAction, startNotePhotoAction } from "@/server/actions/uploads";

const TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 12 * 1024 * 1024;
const MAX_CAPTION = 300;

type Ratio = "tall" | "square" | "wide";
type Stage = { kind: "editing" } | { kind: "posting" } | { kind: "posted"; inReview: boolean } | { kind: "failed"; message: string };

/** The waterfall's height hint, from the photo's own shape. */
const ratioOf = (w: number, h: number): Ratio => (w / h < 0.9 ? "tall" : w / h > 1.15 ? "wide" : "square");

/** Post a photo to Discover: a picture, a caption with #hashtags, and optionally the product in it. */
export function PhotoComposer() {
  const money = useMoney();
  const picker = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [ratio, setRatio] = useState<Ratio>("tall");
  const [caption, setCaption] = useState("");
  const [product, setProduct] = useState<Product | null>(null);
  const [query, setQuery] = useState("");
  const [stage, setStage] = useState<Stage>({ kind: "editing" });
  const [problem, setProblem] = useState<string | null>(null);
  const { products: found } = useProductSearch(query.trim(), {}, "best");

  const previewUrl = useRef<string | null>(null);
  useEffect(() => () => void (previewUrl.current && URL.revokeObjectURL(previewUrl.current)), []);

  function choose(f: File | undefined) {
    setProblem(null);
    if (!f) return;
    if (!TYPES.includes(f.type)) return setProblem("Pick a JPEG, PNG or WebP photo.");
    if (f.size > MAX_BYTES) return setProblem("That photo is over 12 MB.");
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = URL.createObjectURL(f);
    setPreview(previewUrl.current);
    setFile(f);
  }

  async function post() {
    if (!file || !caption.trim()) return;
    setStage({ kind: "posting" });
    const ticket = await startNotePhotoAction({ contentType: file.type, bytes: file.size });
    if (!ticket.ok) return setStage({ kind: "failed", message: ticket.message });
    try {
      await uploadFile(ticket.url, ticket.headers, file, () => {});
    } catch (e) {
      return setStage({ kind: "failed", message: e instanceof Error ? e.message : "The upload didn't finish." });
    }
    const r = await postNoteAction({ photo: ticket.photo, caption, tags: [], productSlug: product?.slug ?? null, ratio });
    setStage(r.ok ? { kind: "posted", inReview: r.inReview } : { kind: "failed", message: r.message });
  }

  if (stage.kind === "posted")
    return (
      <div className="glass flex flex-col items-center gap-3 rounded-[28px] p-6 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-positive/15 text-positive">
          <Icon name="check" className="size-7" />
        </span>
        <h2 className="font-display text-xl font-bold">{stage.inReview ? "Sent for review" : "Posted"}</h2>
        <p className="max-w-xs text-sm text-ink-2">{stage.inReview ? "We check every new post. Once it's approved it goes on Discover, your profile and every hashtag in the caption." : "It's on Discover, your profile and every hashtag in the caption."}</p>
        <div className="mt-2 flex gap-2">
          <Link href="/discover" className="h-11 rounded-full bg-white px-5 text-[15px] leading-11 font-bold text-black">
            See it on Discover
          </Link>
          <button
            type="button"
            onClick={() => {
              setFile(null);
              setPreview(null);
              setCaption("");
              setProduct(null);
              setStage({ kind: "editing" });
            }}
            className="glass-inset h-11 rounded-full px-5 text-[15px] font-semibold"
          >
            Post another
          </button>
        </div>
      </div>
    );

  const busy = stage.kind === "posting";
  const tags = [...new Set(caption.match(/#[\p{L}\p{N}_]+/gu) ?? [])];

  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-6">
      <div className="lg:w-[300px] lg:shrink-0">
        <input ref={picker} type="file" accept={TYPES.join(",")} className="sr-only" aria-label="Choose a photo" onChange={(e) => choose(e.target.files?.[0])} />
        <button type="button" onClick={() => picker.current?.click()} disabled={busy} className="glass-inset relative mx-auto block aspect-[3/4] w-full max-w-[260px] overflow-hidden rounded-[26px]">
          {preview ? (
            // A local blob: next/image can't optimise it, and it's only a preview.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={preview}
              alt=""
              onLoad={(e) => setRatio(ratioOf(e.currentTarget.naturalWidth, e.currentTarget.naturalHeight))}
              className="absolute inset-0 size-full object-cover"
            />
          ) : (
            <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-ink-2">
              <span className="grid size-14 place-items-center rounded-full bg-white/10">
                <Icon name="camera" className="size-7" />
              </span>
              <b className="text-[15px] text-ink">Take or choose a photo</b>
            </span>
          )}
          {preview && !busy && <span className="glass absolute right-2 bottom-2 rounded-full px-3 py-1.5 text-xs font-semibold">Change</span>}
        </button>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-[15px] font-bold">Caption</span>
          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            maxLength={MAX_CAPTION}
            rows={3}
            placeholder="What's the story? Add #hashtags so people find it."
            className="glass-inset rounded-[20px] p-3.5 text-base outline-none placeholder:text-ink-3"
          />
        </label>
        {tags.length > 0 && <p className="-mt-2 text-xs text-agent">{tags.join(" ")}</p>}

        <section aria-label="Product in the photo">
          <h2 className="mb-2 text-[15px] font-bold">
            Product <span className="font-normal text-ink-3">(optional)</span>
          </h2>
          {product ? (
            <div className="glass-inset flex items-center gap-3 rounded-[18px] p-2">
              <Image src={product.images[0]} alt="" width={44} height={44} sizes="44px" className="size-11 rounded-xl object-cover" />
              <span className="min-w-0 flex-1 truncate text-sm font-semibold">{product.title}</span>
              <button type="button" aria-label="Remove product" onClick={() => setProduct(null)} className="grid size-9 place-items-center rounded-full text-ink-2">
                <Icon name="close" className="size-4" />
              </button>
            </div>
          ) : (
            <>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Tag the product people can buy"
                aria-label="Find a product to tag"
                autoComplete="off"
                className="glass-inset h-12 w-full rounded-full px-4 text-base outline-none placeholder:text-ink-3"
              />
              {query.trim() && (
                <ul className="mt-2 flex flex-col gap-1">
                  {found.slice(0, 5).map((p) => (
                    <li key={p.slug}>
                      <button
                        type="button"
                        onClick={() => {
                          setProduct(p);
                          setQuery("");
                        }}
                        className="flex w-full items-center gap-3 rounded-[16px] p-2 text-left hover:bg-white/5"
                      >
                        <Image src={p.images[0]} alt="" width={40} height={40} sizes="40px" className="size-10 rounded-lg object-cover" />
                        <span className="min-w-0 flex-1 truncate text-sm">{p.title}</span>
                        {p.price !== undefined && <span className="text-xs font-semibold text-ink-2">{money(p.price)}</span>}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </section>

        {(problem || stage.kind === "failed") && (
          <p role="alert" className="text-sm text-like">
            {problem ?? (stage.kind === "failed" ? stage.message : "")}
          </p>
        )}
        <button type="button" onClick={post} disabled={!file || !caption.trim() || busy} className="h-[52px] rounded-full bg-accent text-[15px] font-bold disabled:opacity-45">
          {busy ? "Posting…" : "Post photo"}
        </button>
      </div>
    </div>
  );
}
