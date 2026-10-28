"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Icon } from "@/components/icon";
import { acceptInviteAction, declineInviteAction } from "@/server/actions/team";

export type ShopInvite = { id: string; shopName: string; sellerId: string };

/** Invitations to help run a shop, for the person they're addressed to. */
export function ShopInvites({ invites }: { invites: ShopInvite[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  if (!invites.length) return null;

  const run = (work: () => Promise<{ ok: true } | { ok: false; message: string }>) =>
    start(async () => {
      setError(null);
      const r = await work();
      if (!r.ok) return setError(r.message);
      router.refresh();
    });

  return (
    <section aria-labelledby="invites-h" className="mb-4 flex flex-col gap-2">
      <h2 id="invites-h" className="px-1 text-[11px] font-bold tracking-[0.08em] text-ink-3">
        INVITATIONS
      </h2>
      {invites.map((i) => (
        <div key={i.id} className="flex items-center gap-3 rounded-[22px] bg-accent/15 p-3.5 ring-1 ring-accent/30">
          <Icon name="store" className="size-6 shrink-0 text-accent-light" />
          <span className="min-w-0 flex-1 text-sm">
            <b className="font-semibold">{i.shopName}</b> asked you to help run their shop.
          </span>
          <button type="button" disabled={busy} onClick={() => run(() => declineInviteAction(i.id))} className="h-9 shrink-0 rounded-full px-3 text-xs font-semibold text-ink-2">
            Decline
          </button>
          <button type="button" disabled={busy} onClick={() => run(() => acceptInviteAction(i.id))} className="h-9 shrink-0 rounded-full bg-white px-4 text-xs font-bold text-black">
            Join
          </button>
        </div>
      ))}
      {error && (
        <p role="alert" className="text-xs text-like">
          {error}
        </p>
      )}
    </section>
  );
}
