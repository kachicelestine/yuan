"use client";

import dynamic from "next/dynamic";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { useMoney } from "@/components/price";
import { useStore } from "@/components/providers";
import { useProductSearch } from "@/components/search/use-product-search";
import type { Product } from "@/lib/catalog";
import { uploadFile } from "@/lib/upload";
import { publishVideoAction, startUploadAction } from "@/server/actions/uploads";

// Same limits the server enforces (see the content module); checked here so people hear early.
const TYPES = ["video/mp4", "video/quicktime", "video/webm"];
const MAX_BYTES = 300 * 1024 * 1024;
const MAX_CAPTION = 2200;
const MAX_PRODUCTS = 6;

// The camera only loads when someone taps Record.
const CameraRecorder = dynamic(() => import("./camera-recorder").then((m) => m.CameraRecorder), { ssr: false });

type Stage = { kind: "editing" } | { kind: "uploading"; progress: number } | { kind: "posting" } | { kind: "posted" } | { kind: "failed"; message: string };

/** Post a shoppable video: record or pick a clip, tag what's in it, write a caption, upload. */
export function VideoComposer({ embedded = false }: { embedded?: boolean }) {
  const id = useId();
  const money = useMoney();
  const { account } = useStore();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [tagged, setTagged] = useState<Product[]>([]);
  const [query, setQuery] = useState("");
  const [caption, setCaption] = useState("");
  const [tags, setTags] = useState("");
  const [place, setPlace] = useState("");
  const [stage, setStage] = useState<Stage>({ kind: "editing" });
  const [problem, setProblem] = useState<string | null>(null);
  const [camera, setCamera] = useState(false);
  const picker = useRef<HTMLInputElement>(null);
  const Wrap = embedded ? Bare : Frame;
  const { products: found } = useProductSearch(query.trim(), {}, "best");

  // The preview is a blob URL; let it go when the page closes.
  const previewUrl = useRef<string | null>(null);
  useEffect(() => () => void (previewUrl.current && URL.revokeObjectURL(previewUrl.current)), []);

  function choose(f: File | undefined) {
    setProblem(null);
    if (!f) return;
    if (!TYPES.includes(f.type)) return setProblem("Pick an MP4, MOV or WebM video.");
    if (f.size > MAX_BYTES) return setProblem("That video is over 300 MB. Trim it or export it smaller.");
    if (previewUrl.current) URL.revokeObjectURL(previewUrl.current);
    previewUrl.current = URL.createObjectURL(f);
    setPreview(previewUrl.current);
    setFile(f);
  }

  async function post() {
    if (!file || !tagged.length) return;
    setProblem(null);
    setStage({ kind: "uploading", progress: 0 });
    const ticket = await startUploadAction({ contentType: file.type, bytes: file.size });
    if (!ticket.ok) return setStage({ kind: "failed", message: ticket.message });
    try {
      await uploadFile(ticket.url, ticket.headers, file, (progress) => setStage({ kind: "uploading", progress }));
    } catch (error) {
      return setStage({ kind: "failed", message: error instanceof Error ? error.message : "The upload didn't finish." });
    }
    setStage({ kind: "posting" });
    const r = await publishVideoAction({
      key: ticket.key,
      productSlug: tagged[0].slug,
      alsoSlugs: tagged.slice(1).map((p) => p.slug),
      caption,
      tags: tags.split(/[\s,]+/).filter(Boolean),
      place,
    });
    setStage(r.ok ? { kind: "posted" } : { kind: "failed", message: r.message });
  }

  if (!account) {
    return (
      <Wrap>
        <p className="glass-inset rounded-[22px] p-4 text-sm text-ink-2">
          <Link href="/signin?next=/creator/new" className="font-semibold text-ink underline underline-offset-2">
            Sign in
          </Link>{" "}
          to post videos and earn on the orders they bring in.
        </p>
      </Wrap>
    );
  }

  if (stage.kind === "posted") {
    return (
      <Wrap>
        <div className="glass flex flex-col items-center gap-3 rounded-[28px] p-6 text-center">
          <span className="grid size-14 place-items-center rounded-full bg-positive/15 text-positive">
            <Icon name="check" className="size-7" />
          </span>
          <h2 className="font-display text-xl font-bold">Posted</h2>
          <p className="max-w-xs text-sm text-ink-2">We&apos;re preparing it for every screen size. It shows in the feed and on the shop&apos;s page as soon as it&apos;s ready.</p>
          <div className="mt-2 flex gap-2">
            <Link href="/creator" className="h-11 rounded-full bg-white px-5 text-[15px] leading-11 font-bold text-black">
              See your videos
            </Link>
            <button
              type="button"
              onClick={() => {
                setFile(null);
                setPreview(null);
                setCaption("");
                setTags("");
                setTagged([]);
                setStage({ kind: "editing" });
              }}
              className="glass-inset h-11 rounded-full px-5 text-[15px] font-semibold"
            >
              Post another
            </button>
          </div>
        </div>
      </Wrap>
    );
  }

  const busy = stage.kind === "uploading" || stage.kind === "posting";
  const ready = file && tagged.length > 0 && caption.trim().length > 0 && !busy;

  return (
    <Wrap>
      {camera && (
        <CameraRecorder
          onClose={() => setCamera(false)}
          onDone={(f) => {
            setCamera(false);
            choose(f);
          }}
        />
      )}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:gap-6">
        <div className="lg:w-[300px] lg:shrink-0">
          <input ref={picker} type="file" accept={TYPES.join(",")} className="sr-only" aria-label="Choose a video" onChange={(e) => choose(e.target.files?.[0])} />
          <div className="glass-inset relative mx-auto aspect-[9/16] w-full max-w-[260px] overflow-hidden rounded-[26px]">
            {preview ? (
              <video src={preview} className="absolute inset-0 size-full object-cover" muted loop autoPlay playsInline />
            ) : (
              <span className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-5 text-center text-ink-2">
                <button type="button" onClick={() => setCamera(true)} disabled={busy} className="flex flex-col items-center gap-2">
                  <span className="grid size-16 place-items-center rounded-full bg-live text-white shadow-[0_8px_24px_rgb(255_59_92/0.35)]">
                    <Icon name="camera" className="size-7" />
                  </span>
                  <b className="text-[15px] text-ink">Record</b>
                </button>
                <button type="button" onClick={() => picker.current?.click()} disabled={busy} className="glass h-10 rounded-full px-4 text-[13px] font-semibold text-ink">
                  Upload a clip
                </button>
                <span className="text-xs">Vertical works best · up to 3 minutes</span>
              </span>
            )}
            {preview && !busy && (
              <span className="absolute inset-x-2 bottom-2 flex justify-end gap-1.5">
                <button type="button" onClick={() => setCamera(true)} className="glass rounded-full px-3 py-1.5 text-xs font-semibold">
                  Re-record
                </button>
                <button type="button" onClick={() => picker.current?.click()} className="glass rounded-full px-3 py-1.5 text-xs font-semibold">
                  Change
                </button>
              </span>
            )}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-4">
          <section aria-labelledby={`${id}-products`}>
            <h2 id={`${id}-products`} className="mb-2 text-[15px] font-bold">
              What&apos;s in it
            </h2>
            {tagged.length > 0 && (
              <ul className="mb-2 flex flex-col gap-2">
                {tagged.map((p, i) => (
                  <li key={p.slug} className="glass-inset flex items-center gap-3 rounded-[18px] p-2">
                    <Image src={p.images[0]} alt="" width={44} height={44} sizes="44px" className="size-11 rounded-xl object-cover" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">{p.title}</span>
                      <span className="text-xs text-ink-2">{i === 0 ? "Main product" : "Also in the video"}</span>
                    </span>
                    <button type="button" aria-label={`Remove ${p.title}`} onClick={() => setTagged(tagged.filter((t) => t.slug !== p.slug))} className="grid size-9 place-items-center rounded-full text-ink-2">
                      <Icon name="close" className="size-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {tagged.length < MAX_PRODUCTS && (
              <>
                <label htmlFor={`${id}-find`} className="sr-only">
                  Find a product to tag
                </label>
                <input
                  id={`${id}-find`}
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={tagged.length ? "Tag another product" : "Search the product you're showing"}
                  autoComplete="off"
                  className="glass-inset h-12 w-full rounded-full px-4 text-base outline-none placeholder:text-ink-3"
                />
                {query.trim() && (
                  <ul className="mt-2 flex flex-col gap-1">
                    {found
                      .filter((p) => !tagged.some((t) => t.slug === p.slug))
                      .slice(0, 5)
                      .map((p) => (
                        <li key={p.slug}>
                          <button
                            type="button"
                            onClick={() => {
                              setTagged([...tagged, p]);
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

          <label className="flex flex-col gap-1.5">
            <span className="text-[15px] font-bold">Caption</span>
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              maxLength={MAX_CAPTION}
              rows={3}
              placeholder="What should people know? Size, fit, how long it lasted…"
              className="glass-inset rounded-[20px] p-3.5 text-base outline-none placeholder:text-ink-3"
            />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold text-ink-2">Tags</span>
              <input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="#camping #solar" className="glass-inset h-11 rounded-full px-4 text-base outline-none placeholder:text-ink-3" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold text-ink-2">Where</span>
              <input value={place} onChange={(e) => setPlace(e.target.value)} maxLength={80} placeholder="Lagos" className="glass-inset h-11 rounded-full px-4 text-base outline-none placeholder:text-ink-3" />
            </label>
          </div>

          {(problem || stage.kind === "failed") && (
            <p role="alert" className="text-sm text-like">
              {problem ?? (stage.kind === "failed" ? stage.message : "")}
            </p>
          )}

          <button type="button" onClick={post} disabled={!ready} className="relative h-[52px] overflow-hidden rounded-full bg-accent text-[15px] font-bold disabled:opacity-45">
            {stage.kind === "uploading" && <span aria-hidden="true" className="absolute inset-y-0 left-0 bg-white/20 transition-[width]" style={{ width: `${Math.round(stage.progress * 100)}%` }} />}
            <span className="relative">
              {stage.kind === "uploading" ? `Uploading… ${Math.round(stage.progress * 100)}%` : stage.kind === "posting" ? "Posting…" : "Post video"}
            </span>
          </button>
          {!ready && !busy && <p className="text-xs text-ink-3">Record or choose a video, tag at least one product and write a caption.</p>}
        </div>
      </div>
    </Wrap>
  );
}

function Bare({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

function Frame({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-[900px] px-3.5 pt-safe pb-36 lg:px-6 lg:pt-6 lg:pb-16">
      <header className="flex items-center gap-3 pt-2 pb-4 lg:pt-0">
        <Link href="/creator" aria-label="Back" className="glass grid size-11 shrink-0 place-items-center rounded-full">
          <Icon name="back" className="size-5" />
        </Link>
        <h1 className="font-display text-[26px] leading-tight font-extrabold tracking-[-0.03em]">Post a video</h1>
      </header>
      {children}
    </div>
  );
}
