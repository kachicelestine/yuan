"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";

type Props = {
  src: string;
  /** Plays only while its slide is on screen and not paused. */
  playing: boolean;
  paused: boolean;
  muted: boolean;
  /** Hidden while the tab bar is expanded, like the still slides' progress line. */
  showBar: boolean;
};

const time = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** A muted, looping clip over the slide's still, with a pause badge and a scrubber when paused. */
export function ClipPlayer({ src, playing, paused, muted, showBar }: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const [at, setAt] = useState(0);
  const [length, setLength] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    if (playing) v.play().catch(() => setReady(false));
    else v.pause();
  }, [playing]);

  useEffect(() => {
    if (ref.current) ref.current.muted = muted;
  }, [muted]);

  return (
    <>
      <video
        ref={ref}
        src={src}
        muted
        loop
        playsInline
        preload={playing ? "auto" : "none"}
        aria-hidden="true"
        onLoadedMetadata={(e) => setLength(e.currentTarget.duration)}
        onTimeUpdate={(e) => setAt(e.currentTarget.currentTime)}
        onPlaying={() => setReady(true)}
        className={`absolute inset-0 size-full object-cover transition-opacity duration-500 ${ready ? "opacity-100" : "opacity-0"}`}
      />

      {paused && (
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="grid size-20 place-items-center rounded-full bg-black/35 ring-1 ring-white/25 backdrop-blur-md motion-safe:animate-pop">
            <Icon name="play" filled className="ml-1 size-9" />
          </span>
        </span>
      )}

      {(showBar || paused) && length > 0 && (
        <div
          onPointerUp={(e) => e.stopPropagation()}
          className="absolute right-5 bottom-[calc(max(env(safe-area-inset-bottom),16px)+54px)] left-5 z-10 lg:bottom-[68px] xl:bottom-1"
        >
          {paused ? (
            <label className="flex items-center gap-3 text-xs font-semibold text-legible tabular-nums">
              <span className="sr-only">Seek</span>
              {time(at)}
              <input
                type="range"
                min={0}
                max={length}
                step={0.1}
                value={at}
                onChange={(e) => {
                  const v = ref.current;
                  if (v) v.currentTime = Number(e.target.value);
                  setAt(Number(e.target.value));
                }}
                className="h-8 flex-1 cursor-pointer accent-white"
              />
              {time(length)}
            </label>
          ) : (
            <span aria-hidden="true" className="block h-0.5 overflow-hidden rounded-full bg-white/25">
              <span className="block h-full rounded-full bg-white" style={{ width: `${(at / length) * 100}%` }} />
            </span>
          )}
        </div>
      )}
    </>
  );
}
