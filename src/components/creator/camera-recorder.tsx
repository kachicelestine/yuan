"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";

/** Long enough for a product demo; short enough to keep people watching. */
const MAX_SECONDS = 60;

/** What this browser can record, best first (MP4 plays everywhere; WebM is Chrome's own). */
const FORMATS = ["video/mp4;codecs=avc1.42E01E,mp4a.40.2", "video/mp4", "video/webm;codecs=vp9,opus", "video/webm;codecs=vp8,opus", "video/webm"];

function pickFormat(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  return FORMATS.find((f) => MediaRecorder.isTypeSupported(f)) ?? null;
}

type Phase = { kind: "starting" } | { kind: "ready" } | { kind: "recording"; startedAt: number } | { kind: "denied"; message: string };

/**
 * Records a vertical clip with the phone's camera, TikTok-style: hold the screen to frame,
 * tap the button to start and again to stop (it stops itself at a minute). Hands back a
 * File the composer uploads like any other.
 */
export function CameraRecorder({ onDone, onClose }: { onDone: (file: File) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  const [facing, setFacing] = useState<"user" | "environment">("environment");
  const [phase, setPhase] = useState<Phase>({ kind: "starting" });
  const [elapsed, setElapsed] = useState(0);

  const stopTracks = () => {
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
  };

  // Open (or reopen, after a flip) the camera.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia || !pickFormat()) {
        setPhase({ kind: "denied", message: "This browser can't record video. Upload a clip instead." });
        return;
      }
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 1080 }, height: { ideal: 1920 }, aspectRatio: { ideal: 9 / 16 } },
          audio: true,
        });
        if (cancelled) return s.getTracks().forEach((t) => t.stop());
        stopTracks();
        stream.current = s;
        if (video.current) {
          video.current.srcObject = s;
          await video.current.play().catch(() => {});
        }
        setPhase({ kind: "ready" });
      } catch {
        setPhase({ kind: "denied", message: "Allow camera and microphone access to record, or upload a clip instead." });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [facing]);

  // Let the camera go when the recorder closes.
  useEffect(() => () => stopTracks(), []);

  const stop = useCallback(() => {
    if (recorder.current?.state === "recording") recorder.current.stop();
  }, []);

  // The clock, and the one-minute cap.
  useEffect(() => {
    if (phase.kind !== "recording") return;
    const timer = setInterval(() => {
      const s = (Date.now() - phase.startedAt) / 1000;
      setElapsed(s);
      if (s >= MAX_SECONDS) stop();
    }, 200);
    return () => clearInterval(timer);
  }, [phase, stop]);

  function start() {
    const format = pickFormat();
    if (!stream.current || !format) return;
    chunks.current = [];
    const r = new MediaRecorder(stream.current, { mimeType: format, videoBitsPerSecond: 4_000_000 });
    r.ondataavailable = (e) => e.data.size && chunks.current.push(e.data);
    r.onstop = () => {
      const type = format.split(";")[0];
      const blob = new Blob(chunks.current, { type });
      setPhase({ kind: "ready" });
      setElapsed(0);
      if (blob.size < 1000) return;
      stopTracks();
      onDone(new File([blob], `clip-${Date.now()}.${type === "video/mp4" ? "mp4" : "webm"}`, { type }));
    };
    recorder.current = r;
    r.start(1000);
    setElapsed(0);
    setPhase({ kind: "recording", startedAt: Date.now() });
  }

  const recording = phase.kind === "recording";
  const progress = Math.min(1, elapsed / MAX_SECONDS);

  return (
    <div role="dialog" aria-modal="true" aria-label="Record a video" className="fixed inset-0 z-50 bg-black">
      <video ref={video} muted playsInline className={`absolute inset-0 size-full object-cover ${facing === "user" ? "-scale-x-100" : ""}`} />

      <div className="pt-safe absolute inset-x-0 top-0 flex items-center justify-between px-4 pt-3">
        <button
          type="button"
          onClick={() => {
            stop();
            stopTracks();
            onClose();
          }}
          aria-label="Close camera"
          className="grid size-11 place-items-center rounded-full bg-black/45 text-white backdrop-blur"
        >
          <Icon name="close" className="size-5" />
        </button>
        {recording && (
          <span className="flex h-8 items-center gap-1.5 rounded-full bg-live px-3 text-[13px] font-bold text-white tabular-nums">
            <span className="size-2 animate-pulse rounded-full bg-white" />
            {Math.floor(elapsed)}s / {MAX_SECONDS}s
          </span>
        )}
        <button
          type="button"
          disabled={recording}
          onClick={() => setFacing((f) => (f === "user" ? "environment" : "user"))}
          aria-label="Flip camera"
          className="grid size-11 place-items-center rounded-full bg-black/45 text-white backdrop-blur disabled:opacity-40"
        >
          <Icon name="returns" className="size-5" />
        </button>
      </div>

      {phase.kind === "denied" && (
        <div className="absolute inset-0 grid place-items-center px-8 text-center">
          <div className="flex max-w-xs flex-col items-center gap-3 text-white">
            <Icon name="camera" className="size-10 opacity-70" />
            <p className="text-sm">{phase.message}</p>
            <button type="button" onClick={onClose} className="h-11 rounded-full bg-white px-5 text-[15px] font-bold text-black">
              Back
            </button>
          </div>
        </div>
      )}

      {phase.kind !== "denied" && (
        <div className="pb-safe absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 pb-8">
          <p className="text-xs font-semibold text-white/80 drop-shadow">{recording ? "Tap to stop" : phase.kind === "starting" ? "Opening the camera…" : "Tap to record"}</p>
          <button
            type="button"
            disabled={phase.kind === "starting"}
            onClick={recording ? stop : start}
            aria-label={recording ? "Stop recording" : "Start recording"}
            className="relative grid size-20 place-items-center rounded-full disabled:opacity-50"
          >
            <svg viewBox="0 0 80 80" className="absolute inset-0 size-full -rotate-90" aria-hidden="true">
              <circle cx="40" cy="40" r="36" fill="none" stroke="rgb(255 255 255 / 0.5)" strokeWidth="5" />
              {recording && <circle cx="40" cy="40" r="36" fill="none" stroke="#ff3b5c" strokeWidth="5" strokeDasharray={`${progress * 226.2} 226.2`} strokeLinecap="round" />}
            </svg>
            <span className={`bg-live transition-all ${recording ? "size-8 rounded-lg" : "size-[58px] rounded-full"}`} />
          </button>
        </div>
      )}
    </div>
  );
}
