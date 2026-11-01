"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useStore } from "@/components/providers";
import { closeAccountAction } from "@/server/actions/account";

/** Taking your data with you, and leaving. */
export function AccountControls() {
  const router = useRouter();
  const { refreshAccount } = useStore();
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  function close() {
    setError(null);
    start(async () => {
      const r = await closeAccountAction();
      if (!r.ok) return setError(r.message);
      await refreshAccount();
      router.replace("/");
    });
  }

  return (
    <section aria-label="Your data" className="glass mt-4 flex flex-col gap-3 rounded-[26px] p-4">
      <h2 className="text-[15px] font-bold">Your data</h2>
      <a href="/api/me/export" className="glass-inset grid h-12 place-items-center rounded-full text-[15px] font-semibold">
        Download my data
      </a>
      {confirming ? (
        <div className="flex flex-col gap-2 rounded-2xl bg-like/10 p-3">
          <p className="text-sm text-ink">This deletes your profile, bag, coins, coupons and lists, and signs you out everywhere. It can&apos;t be undone. Order records stay for tax law.</p>
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={close} className="h-11 flex-1 rounded-full bg-like text-sm font-bold disabled:opacity-50">
              {busy ? "Deleting…" : "Delete my account"}
            </button>
            <button type="button" disabled={busy} onClick={() => setConfirming(false)} className="glass-inset h-11 rounded-full px-5 text-sm font-semibold">
              Keep it
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className="h-11 rounded-full text-sm font-semibold text-like">
          Delete my account
        </button>
      )}
      {error && (
        <p role="alert" className="text-sm text-like">
          {error}
        </p>
      )}
    </section>
  );
}
