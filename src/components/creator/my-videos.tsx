"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icon";
import { useStore } from "@/components/providers";
import type { MyVideoView } from "@/modules/content";
import { compact } from "@/lib/format";

// Badges sit on top of the poster, so they get a dark backing whatever the footage looks like.
const STATUS: Record<MyVideoView["status"], { label: string; dot: string }> = {
  processing: { label: "Preparing", dot: "bg-white/60" },
  review: { label: "In review", dot: "bg-save" },
  ready: { label: "Live", dot: "bg-positive" },
  failed: { label: "Couldn't process", dot: "bg-like" },
  removed: { label: "Removed", dot: "bg-white/40" },
};

/** The creator's own videos with where each one is: preparing, in review, live. */
export function MyVideos() {
  const { account } = useStore();
  const [videos, setVideos] = useState<MyVideoView[] | null>(null);
  const waiting = videos?.some((v) => v.status === "processing") ?? false;

  useEffect(() => {
    if (!account) return;
    let stop = false;
    const load = () =>
      fetch("/api/me/videos", { cache: "no-store" })
        .then((res) => (res.ok ? (res.json() as Promise<{ videos: MyVideoView[] }>) : { videos: [] }))
        .then(({ videos: list }) => !stop && setVideos(list))
        .catch(() => {});
    void load();
    // While something is being prepared, check back now and then.
    const timer = waiting ? setInterval(load, 5_000) : undefined;
    return () => {
      stop = true;
      if (timer) clearInterval(timer);
    };
  }, [account, waiting]);

  return (
    <section aria-labelledby="mine-h" className="mt-5">
      <div className="mb-3 flex items-center justify-between px-1">
        <h2 id="mine-h" className="text-[15px] font-bold">
          Your videos
        </h2>
        <Link href="/creator/new" className="flex h-9 items-center gap-1.5 rounded-full bg-accent px-4 text-[13px] font-bold">
          <Icon name="plus" className="size-4" />
          Post a video
        </Link>
      </div>
      {!account ? (
        <p className="glass-inset rounded-[22px] p-4 text-sm text-ink-2">
          <Link href="/signin?next=/creator" className="font-semibold text-ink underline underline-offset-2">
            Sign in
          </Link>{" "}
          to post videos and see how they do.
        </p>
      ) : videos === null ? (
        <div className="skeleton h-28 rounded-[22px]" />
      ) : videos.length === 0 ? (
        <p className="glass-inset rounded-[22px] p-4 text-sm text-ink-2">Nothing posted yet. Show something you bought: people trust a real hand holding it.</p>
      ) : (
        <ul className="no-scrollbar -mx-3.5 flex gap-2.5 overflow-x-auto px-3.5 lg:mx-0 lg:px-0">
          {videos.map((v) => (
            <li key={v.id} className="w-[132px] shrink-0">
              <Link href={v.status === "ready" ? `/?v=${v.id}` : "/creator"} className="relative block aspect-[9/16] overflow-hidden rounded-[20px] bg-surface">
                {v.image && <Image src={v.image} alt="" fill sizes="132px" className="object-cover" />}
                <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30" />
                <span className="absolute top-2 left-2 flex items-center gap-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[10.5px] font-bold text-white backdrop-blur-sm">
                  <span aria-hidden="true" className={`size-1.5 rounded-full ${STATUS[v.status].dot}`} />
                  {STATUS[v.status].label}
                </span>
                <span className="absolute inset-x-2 bottom-2 text-[11px] font-semibold text-legible">
                  <span className="line-clamp-2">{v.caption}</span>
                  {v.status === "ready" && (
                    <span className="mt-0.5 flex items-center gap-2 text-white/80">
                      <span className="flex items-center gap-0.5">
                        <Icon name="eye" className="size-3" />
                        {compact(v.views)}
                      </span>
                      <span className="flex items-center gap-0.5">
                        <Icon name="heart" className="size-3" />
                        {compact(v.likes)}
                      </span>
                    </span>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
