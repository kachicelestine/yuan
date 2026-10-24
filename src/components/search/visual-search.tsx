"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";
import { ProductCard } from "@/components/product/product-card";
import { getProduct, snapFallback, snapSamples, type Product, type SnapSample } from "@/lib/catalog";

type Phase = "frame" | "analyzing" | "results";

/**
 * Snap to search: point the camera at anything (or upload, or try a sample) and get
 * matching products. Matching is a fixture until the vision service exists.
 */
export function VisualSearch({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const [sample, setSample] = useState<SnapSample>(snapSamples[0]);
  const [shot, setShot] = useState<string | null>(null);
  const [camera, setCamera] = useState<"off" | "on" | "blocked">("off");
  const [phase, setPhase] = useState<Phase>("frame");

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (phase !== "analyzing") return;
    const t = setTimeout(() => setPhase("results"), 1500);
    return () => clearTimeout(t);
  }, [phase]);

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

  function capture() {
    const v = video.current;
    if (camera === "on" && v && v.videoWidth) {
      const canvas = document.createElement("canvas");
      canvas.width = v.videoWidth;
      canvas.height = v.videoHeight;
      canvas.getContext("2d")?.drawImage(v, 0, 0);
      setShot(canvas.toDataURL("image/jpeg", 0.85));
      stopCamera();
      setCamera("off");
    }
    setPhase("analyzing");
  }

  function upload(file: File | undefined) {
    if (!file) return;
    stopCamera();
    setCamera("off");
    setShot(URL.createObjectURL(file));
    setPhase("analyzing");
  }

  function pickSample(s: SnapSample) {
    stopCamera();
    setCamera("off");
    setShot(null);
    setSample(s);
    setPhase("frame");
  }

  const matches = (shot ? snapFallback : sample.matches)
    .map(([slug, score]) => ({ product: getProduct(slug), score }))
    .filter((m): m is { product: Product; score: number } => !!m.product);
  const guess = shot ? "Closest matches" : sample.guess;

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
          ) : (
            <Image key={shot ?? sample.id} src={shot ?? sample.image} alt="" fill unoptimized={!!shot} sizes="100vw" className="object-cover motion-safe:animate-[rise_0.5s_var(--ease-soft)_both]" />
          )}
          <div aria-hidden="true" className={`pointer-events-none absolute inset-[18%_12%_24%] rounded-[28px] transition-opacity ${phase === "results" ? "opacity-0" : ""}`}>
            {["top-0 left-0 border-t-4 border-l-4 rounded-tl-[28px]", "top-0 right-0 border-t-4 border-r-4 rounded-tr-[28px]", "bottom-0 left-0 border-b-4 border-l-4 rounded-bl-[28px]", "bottom-0 right-0 border-b-4 border-r-4 rounded-br-[28px]"].map((c) => (
              <span key={c} className={`absolute size-12 border-white drop-shadow-[0_2px_8px_rgb(0_0_0/0.4)] ${c} ${phase === "frame" ? "motion-safe:animate-breathe" : ""}`} />
            ))}
            {phase === "analyzing" && (
              <span className="absolute inset-x-3 h-0.5 animate-scan rounded-full bg-white shadow-[0_0_24px_6px_rgb(255_255_255/0.6)]" />
            )}
          </div>
          <p role="status" className={`glass absolute bottom-[calc(24%-56px)] left-1/2 -translate-x-1/2 rounded-full px-4 py-2 text-[13px] font-semibold whitespace-nowrap ${phase === "results" ? "invisible" : ""}`}>
            {phase === "analyzing"
              ? "Looking for matches…"
              : camera === "blocked"
                ? "Camera is blocked. Upload a photo instead."
                : "Fill the frame with one product"}
          </p>
        </div>

        <div className="pb-safe relative z-10 flex flex-col gap-4 bg-black px-4 pt-4">
          <div className="flex items-center justify-between">
            <label className="glass grid size-14 cursor-pointer place-items-center rounded-full" aria-label="Upload a photo">
              <Icon name="plus" />
              <input type="file" accept="image/*" className="sr-only" onChange={(e) => upload(e.target.files?.[0])} />
            </label>
            <button
              type="button"
              onClick={capture}
              disabled={phase === "analyzing"}
              aria-label="Search this photo"
              className="grid size-[78px] place-items-center rounded-full ring-4 ring-white/90 ring-offset-4 ring-offset-black transition-transform active:scale-95"
            >
              <span className="size-[62px] rounded-full bg-white" />
            </button>
            <button type="button" onClick={startCamera} aria-label="Use the camera" className="glass grid size-14 place-items-center rounded-full">
              <Icon name="camera" />
            </button>
          </div>
          <div>
            <p className="mb-2 text-xs font-semibold text-ink-3">Try a sample</p>
            <div className="no-scrollbar flex gap-2 overflow-x-auto">
              {snapSamples.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => pickSample(s)}
                  aria-pressed={!shot && camera !== "on" && sample.id === s.id}
                  className={`relative h-16 w-[52px] shrink-0 overflow-hidden rounded-xl transition-shadow ${!shot && camera !== "on" && sample.id === s.id ? "ring-2 ring-white" : "opacity-70"}`}
                >
                  <Image src={s.image} alt={s.label} fill sizes="52px" className="object-cover" />
                </button>
              ))}
            </div>
          </div>
        </div>

        {phase === "results" && (
          <section aria-label="Matches" className="glass-sheet absolute inset-x-0 bottom-0 z-30 flex max-h-[78%] flex-col rounded-t-[34px] before:bg-raised motion-safe:animate-[rise_0.45s_var(--ease-soft)_both]">
            <div className="flex items-start gap-3 px-4 pt-4 pb-3">
              <div className="flex-1">
                <p className="text-xs font-semibold text-ink-2">Looks like</p>
                <h2 className="font-display text-[22px] font-bold tracking-[-0.02em]">{guess}</h2>
              </div>
              <button type="button" onClick={() => setPhase("frame")} className="glass-inset h-10 rounded-full px-4 text-[13px] font-semibold">
                Retake
              </button>
            </div>
            <ul className="no-scrollbar grid min-h-0 flex-1 grid-cols-2 gap-2.5 overflow-y-auto px-4 pb-3 sm:grid-cols-4">
              {matches.map(({ product, score }) => (
                // Navigating away unmounts the dialog (and stops the camera), so no close here.
                <li key={product.slug}>
                  <ProductCard product={product} sizes="(min-width: 640px) 25vw, 50vw" badge={`${score}% match`} />
                </li>
              ))}
            </ul>
            <div className="pb-safe px-4 pt-1">
              <Link
                href={`/search?q=${encodeURIComponent(shot ? "" : sample.guess.toLowerCase())}`}
                onClick={close}
                className="grid h-[52px] place-items-center rounded-full bg-accent text-[15px] font-bold"
              >
                {shot ? "Describe it in words instead" : `Search “${sample.guess.toLowerCase()}”`}
              </Link>
            </div>
          </section>
        )}
      </div>
    </dialog>
  );
}

