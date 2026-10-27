"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/icon";
import { compact } from "@/lib/format";
import { FollowPerson } from "./follow-person";

export type Viewer = { signedIn: boolean; isSelf: boolean; followed: boolean } | null;

/** Counts and the one action that fits the viewer: follow, or edit when it's you. */
export function ProfileActions({ handle, followers, following, likes, viewer }: { handle: string; followers: number; following: number; likes: number; viewer: Viewer }) {
  const [count, setCount] = useState(followers);
  const [copied, setCopied] = useState(false);

  async function share() {
    const url = `${location.origin}/u/${handle}`;
    try {
      if (navigator.share) await navigator.share({ url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
      }
    } catch {
      // Dismissed share sheet: nothing to do.
    }
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <dl className="flex items-center gap-6 text-center">
        {[
          { label: "Following", value: following },
          { label: "Followers", value: count },
          { label: "Likes", value: likes },
        ].map((s) => (
          <div key={s.label} className="flex flex-col-reverse">
            <dt className="text-xs text-ink-2">{s.label}</dt>
            <dd className="font-display text-lg font-extrabold tabular-nums">{compact(s.value)}</dd>
          </div>
        ))}
      </dl>
      <div className="flex items-center gap-2">
        {viewer?.isSelf ? (
          <Link href="/me/profile" className="glass-inset grid h-11 place-items-center rounded-full px-6 text-[15px] font-bold">
            Edit profile
          </Link>
        ) : viewer ? (
          <FollowPerson handle={handle} initial={viewer.followed} signedIn={viewer.signedIn} onChange={setCount} />
        ) : (
          <span aria-hidden="true" className="skeleton h-11 w-28 rounded-full" />
        )}
        <button type="button" onClick={share} aria-label={copied ? "Link copied" : "Share profile"} className="glass-inset grid size-11 place-items-center rounded-full">
          <Icon name={copied ? "check" : "share"} className="size-5" />
        </button>
      </div>
    </div>
  );
}
