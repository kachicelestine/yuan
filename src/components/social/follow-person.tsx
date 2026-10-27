"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { writeStored } from "@/lib/use-stored";
import { followPersonAction } from "@/server/actions/social";

/** Follow or unfollow a person. Signed out, it asks you to sign in first. */
export function FollowPerson({ handle, initial, signedIn, onChange, size = "md" }: { handle: string; initial: boolean; signedIn: boolean; onChange?: (followers: number) => void; size?: "sm" | "md" }) {
  const [on, setOn] = useState(initial);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const cls = size === "sm" ? "h-9 px-4 text-[13px]" : "h-11 px-6 text-[15px]";

  if (!signedIn)
    return (
      <Link href={`/signin?next=/u/${handle}`} className={`grid shrink-0 place-items-center rounded-full bg-accent font-bold text-white ${cls}`}>
        Follow
      </Link>
    );

  return (
    <>
      <button
        type="button"
        aria-pressed={on}
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const next = !on;
            setOn(next);
            const r = await followPersonAction(handle, next);
            if (!r.ok) {
              setOn(!next);
              return setError(r.message);
            }
            // The Following feed reloads with (or without) their posts.
            writeStored("app.peopleRev", Date.now());
            onChange?.(r.followers);
          })
        }
        className={`shrink-0 rounded-full font-bold transition-colors disabled:opacity-70 ${cls} ${on ? "glass-inset text-ink-2" : "bg-accent text-white"}`}
      >
        {on ? "Following" : "Follow"}
      </button>
      {error && (
        <p role="alert" className="text-xs text-like">
          {error}
        </p>
      )}
    </>
  );
}
