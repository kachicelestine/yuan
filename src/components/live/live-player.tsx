"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Plays a live HLS stream, with hls.js (loaded on demand, so pages without a live stream
 * never download it) or the browser's own HLS where Media Source isn't available.
 * Starts muted, like any autoplaying video; the room's sound button unmutes it.
 */
export function LivePlayer({ src, muted, className }: { src: string; muted: boolean; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    let destroy = () => {};
    let cancelled = false;
    video.muted = true;
    const native = () => {
      video.src = src;
      void video.play().catch(() => {});
    };
    // hls.js wherever Media Source works (most browsers, iOS 17.1+); the browser's own HLS
    // otherwise (older iPhones). Loaded on demand, so only live rooms download it.
    void import("hls.js")
      .then(({ default: Hls }) => {
        if (cancelled) return;
        if (!Hls.isSupported()) return native();
        const hls = new Hls({ lowLatencyMode: true, liveSyncDurationCount: 2 });
        hls.loadSource(src);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => void video.play().catch(() => {}));
        destroy = () => hls.destroy();
      })
      .catch(() => {
        if (!cancelled) native();
      });
    const stop = () => {
      cancelled = true;
      destroy();
    };
    return stop;
  }, [src]);

  useEffect(() => {
    if (ref.current) ref.current.muted = muted;
  }, [muted]);

  return (
    <video
      ref={ref}
      playsInline
      autoPlay
      muted
      onPlaying={() => setPlaying(true)}
      className={`${className ?? ""} transition-opacity duration-500 ${playing ? "opacity-100" : "opacity-0"}`}
    />
  );
}
