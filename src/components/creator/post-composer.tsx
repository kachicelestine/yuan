"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/icon";
import { useStore } from "@/components/providers";
import { PhotoComposer } from "./photo-composer";
import { VideoComposer } from "./video-composer";

type Kind = "video" | "photo";

/** Make a post: a shoppable video (recorded here or uploaded) or a photo. */
export function PostComposer({ initial = "video" }: { initial?: Kind }) {
  const [kind, setKind] = useState<Kind>(initial);
  const { account } = useStore();
  return (
    <div className="mx-auto max-w-[900px] px-3.5 pt-safe pb-36 lg:px-6 lg:pt-6 lg:pb-16">
      <header className="flex items-center gap-3 pt-2 pb-4 lg:pt-0">
        <Link href="/creator" aria-label="Back" className="glass grid size-11 shrink-0 place-items-center rounded-full">
          <Icon name="back" className="size-5" />
        </Link>
        <h1 className="font-display text-[26px] leading-tight font-extrabold tracking-[-0.03em]">New post</h1>
      </header>
      {account && (
        <div role="radiogroup" aria-label="What to post" className="glass mb-4 grid grid-cols-2 rounded-full p-1">
          {(["video", "photo"] as const).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={kind === k} onClick={() => setKind(k)} className={`h-10 rounded-full text-sm font-semibold capitalize ${kind === k ? "bg-white/15 text-ink" : "text-ink-2"}`}>
              {k}
            </button>
          ))}
        </div>
      )}
      {kind === "video" ? <VideoComposer embedded /> : <PhotoComposer />}
    </div>
  );
}
