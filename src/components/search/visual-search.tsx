"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { ProductCard } from "@/components/product/product-card";
import type { Product } from "@/lib/catalog";
import { photoFromFile, shrinkPhoto } from "@/lib/photo";

type Phase = "frame" | "analyzing" | "results";
type Result = { found: false } | { found: true; name: string; query: string; products: Product[] };

/**
 * Snap to search: point the camera at something (or upload a photo) and find it in the
 * catalog. Gemini names what's in the photo; the catalog search finds the listings.
 */
export function VisualSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [shot, setShot] = useState<string | null>(null);
  const [camera, setCamera] = useState<"off" | "on" | "blocked">("off");
  const [phase, setPhase] = useState<Phase>("frame");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => () => stopCamera(), []);

  function stopCamera() {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  }

  function close() {
    stopCamera();
    setCamera("off");
    setPhase("frame");
    onClose();
  }

  async function startCamera() {
    try {
      const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      stream.current = media;
      setShot(null);
      setCamera("on");
      setPhase("frame");
      requestAnimationFrame(() => {
        if (video.current) video.current.srcObject = media;
      });
    } catch {
      setCamera("blocked");
    }
  }

  async function search(photo: { url: string; data: string }) {
    setShot(photo.url);
    setPhase("analyzing");
    setError(null);
    try {
      const res = await fetch("/api/snap", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mediaType: "image/jpeg", data: photo.data }) });
      if (!res.ok) {
        setError(res.status === 429 ? "That's a lot of photos this hour. Try again later, or search in words." : res.status === 503 ? "Photo search isn't switched on yet. Search in words instead." : "Couldn't read that photo. Try again.");
        setPhase("frame");
        return;
      }
      setResult((await res.json()) as Result);
      setPhase("results");
    } catch {
      setError("The connection dropped. Try again.");
      setPhase("frame");
    }
  }

  async function capture() {
    const v = video.current;
    if (camera !== "on" || !v || !v.videoWidth) return;
    const photo = shrinkPhoto(v, v.videoWidth, v.videoHeight);
    stopCamera();
    setCamera("off");
    await search(photo);
  }

  async function upload(file: File | undefined) {
    if (!file) return;
    stopCamera();
    setCamera("off");
    try {
      await search(await photoFromFile(file));
    } catch {
      setError("That file isn't a photo we can read.");
    }
  }

  return (
    <dialog
      ref={ref}
      aria-label="Snap to search"
      onCancel={(e) => {
        e.preventDefault();
        close();
      }}
      className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none overflow-hidden border-0 bg-black p-0 text-ink backdrop:bg-black"
    >
      <div className="relative flex h-full flex-col">
        <header className="pt-safe absolute inset-x-0 top-0 z-20 flex items-center justify-between px-3">
          <button type="button" onClick={close} aria-label="Close" className="glass grid size-12 place-items-center rounded-full">
            <Icon name="close" />
          </button>
          <p className="glass rounded-full px-4 py-2.5 text-sm font-semibold">Snap to search</p>
          <span className="size-12" />
        </header>

        <div data-tone="light" className="relative min-h-0 flex-1 overflow-hidden">
          {camera === "on" ? (
            <video ref={video} autoPlay playsInline muted className="absolute inset-0 size-full object-cover" />
          ) : shot ? (
            <Image key={shot} src={shot} alt="" fill unoptimized sizes="100vw" className="object-cover motion-safe:animate-[rise_0.5s_var(--ease-soft)_both]" />
          ) : (
            <div className="absolute inset-0 grid place-items-center bg-[radial-gradient(80%_60%_at_50%_40%,#2a2333_0%,#000_75%)]">
              <Icon name="camera" className="size-12 text-white/30" />
            </div>
          )}
          <div aria-hidden="true" className={`pointer-events-none absolute inset-[18%_12%_24%] rounded-[28px] transition-opacity ${phase === "results" ? "opacity-0" : ""}`}>
            {["top-0 left-0 border-t-4 border-l-4 rounded-tl-[28px]", "top-0 right-0 border-t-4 border-r-4 rounded-tr-[28px]", "bottom-0 left-0 border-b-4 border-l-4 rounded-bl-[28px]", "bottom-0 right-0 border-b-4 border-r-4 rounded-br-[28px]"].map((c) => (
              <span key={c} className={`absolute size-12 border-white drop-shadow-[0_2px_8px_rgb(0_0_0/0.4)] ${c} ${phase === "frame" ? "motion-safe:animate-breathe" : ""}`} />
            ))}
            {phase === "analyzing" && <span className="absolute inset-x-3 h-0.5 animate-scan rounded-full bg-white shadow-[0_0_24px_6px_rgb(255_255_255/0.6)]" />}
          </div>
          <p role="status" className={`glass absolute bottom-[calc(24%-56px)] left-1/2 max-w-[90%] -translate-x-1/2 rounded-full px-4 py-2 text-center text-[13px] font-semibold ${phase === "results" ? "invisible" : ""}`}>
            {phase === "analyzing" ? "Looking for it…" : error ? error : camera === "blocked" ? "Camera is blocked. Upload a photo instead." : camera === "on" ? "Fill the frame with one product" : "Use the camera, or upload a photo"}
          </p>
        </div>

        <div className="pb-safe relative z-10 flex items-center justify-between bg-black px-4 pt-4 pb-4">
          <label className="glass grid size-14 cursor-pointer place-items-center rounded-full" aria-label="Upload a photo">
            <Icon name="plus" />
            <input type="file" accept="image/*" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} />
          </label>
          <button
            type="button"
            onClick={camera === "on" ? capture : startCamera}
            disabled={phase === "analyzing"}
            aria-label={camera === "on" ? "Search this photo" : "Use the camera"}
            className="grid size-[78px] place-items-center rounded-full ring-4 ring-white/90 ring-offset-4 ring-offset-black transition-transform active:scale-95"
          >
            <span className="grid size-[62px] place-items-center rounded-full bg-white text-black">{camera === "on" ? null : <Icon name="camera" />}</span>
          </button>
          <Link href="/search" onClick={close} aria-label="Search in words" className="glass grid size-14 place-items-center rounded-full">
            <Icon name="search" />
          </Link>
        </div>

        {phase === "results" && result && (
          <section aria-label="Matches" className="glass-sheet absolute inset-x-0 bottom-0 z-30 flex max-h-[78%] flex-col rounded-t-[34px] before:bg-raised motion-safe:animate-[rise_0.45s_var(--ease-soft)_both]">
            <div className="flex items-start gap-3 px-4 pt-4 pb-3">
              <div className="flex-1">
                <p className="text-xs font-semibold text-ink-2">{result.found ? "Looks like" : "Hmm"}</p>
                <h2 className="font-display text-[22px] font-bold tracking-[-0.02em]">{result.found ? result.name : "We couldn't tell what that is"}</h2>
              </div>
              <button type="button" onClick={() => setPhase("frame")} className="glass-inset h-10 rounded-full px-4 text-[13px] font-semibold">
                Retake
              </button>
            </div>
            {result.found && result.products.length > 0 ? (
              <ul className="no-scrollbar grid min-h-0 flex-1 grid-cols-2 gap-2.5 overflow-y-auto px-4 pb-3 sm:grid-cols-4">
                {result.products.map((product) => (
                  // Navigating away unmounts the dialog (and stops the camera), so no close here.
                  <li key={product.slug}>
                    <ProductCard product={product} sizes="(min-width: 640px) 25vw, 50vw" />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 pb-3 text-sm text-ink-2">{result.found ? "Nothing like it is listed yet." : "Try a closer photo of just the product, or describe it in words."}</p>
            )}
            <div className="pb-safe px-4 pt-1 pb-4">
              <Link href={`/search?q=${encodeURIComponent(result.found ? result.query : "")}`} onClick={close} className="grid h-[52px] place-items-center rounded-full bg-accent text-[15px] font-bold">
                {result.found ? `Search “${result.query}”` : "Describe it in words"}
              </Link>
            </div>
          </section>
        )}
      </div>
    </dialog>
  );
}
