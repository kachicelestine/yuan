"use client";

import { useEffect, useState } from "react";
import { useStored } from "@/lib/use-stored";

export type PeopleFollowing = { me: string | null; handles: Set<string> };

let cached: { rev: number; data: Promise<PeopleFollowing> } | null = null;

/** Your handle and the people you follow, fetched once and again after you follow someone. */
export function usePeopleFollowing(signedIn: boolean): PeopleFollowing | null {
  const [rev] = useStored<number>("app.peopleRev", 0);
  const [data, setData] = useState<PeopleFollowing | null>(null);
  useEffect(() => {
    if (!signedIn) return;
    if (!cached || cached.rev !== rev)
      cached = {
        rev,
        data: fetch("/api/me/people")
          .then((r) => (r.ok ? (r.json() as Promise<{ me: string | null; handles: string[] }>) : { me: null, handles: [] }))
          .then((r) => ({ me: r.me, handles: new Set(r.handles) }))
          .catch(() => ({ me: null, handles: new Set<string>() })),
      };
    let live = true;
    void cached.data.then((d) => live && setData(d));
    return () => {
      live = false;
    };
  }, [signedIn, rev]);
  return signedIn ? data : null;
}
