"use client";

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/icon";
import { useStore } from "@/components/providers";
import { REASON_LABELS, REPORT_REASONS, type ReportReason, type ReportTarget } from "@/modules/content";
import { reportAction } from "@/server/actions/content";

/** Pick what's wrong, optionally say more, send. Shown inline where the report starts. */
export function ReportForm({ targetType, targetId, onDone }: { targetType: ReportTarget; targetId: string; onDone?: () => void }) {
  const { account } = useStore();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  if (!account) {
    return (
      <p className="px-4 py-3 text-sm text-ink-2">
        <Link href="/signin" className="font-semibold text-ink underline underline-offset-2">
          Sign in
        </Link>{" "}
        to report, so we can follow up if needed.
      </p>
    );
  }
  if (state === "sent") {
    return (
      <p role="status" className="flex items-center gap-2 px-4 py-3 text-sm text-ink-2">
        <Icon name="check" className="size-4 text-positive" />
        Thanks. A moderator will look at it.
      </p>
    );
  }

  async function send() {
    if (!reason) return;
    setState("sending");
    setError(null);
    const r = await reportAction({ targetType, targetId, reason, note: note.trim() || null });
    if (!r.ok) {
      setState("idle");
      return setError(r.message);
    }
    setState("sent");
    onDone?.();
  }

  return (
    <div className="flex flex-col gap-2.5 px-4 py-3">
      <fieldset>
        <legend className="mb-2 text-[13px] font-semibold text-ink-2">What&apos;s wrong?</legend>
        <div className="flex flex-wrap gap-1.5">
          {REPORT_REASONS.map((r) => (
            <button key={r} type="button" aria-pressed={reason === r} onClick={() => setReason(r)} className={`h-9 rounded-full px-3 text-[13px] font-semibold ${reason === r ? "bg-white text-black" : "glass-inset text-ink-2"}`}>
              {REASON_LABELS[r]}
            </button>
          ))}
        </div>
      </fieldset>
      {reason && (
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={500}
          rows={2}
          aria-label="More detail"
          placeholder={reason === "other" ? "Tell us what's wrong" : "Anything else? (optional)"}
          className="glass-inset rounded-2xl p-3 text-base outline-none placeholder:text-ink-3"
        />
      )}
      {error && (
        <p role="alert" className="text-sm text-like">
          {error}
        </p>
      )}
      <button type="button" disabled={!reason || state === "sending"} onClick={send} className="h-10 self-start rounded-full bg-like/90 px-5 text-sm font-bold text-white disabled:opacity-40">
        {state === "sending" ? "Sending…" : "Send report"}
      </button>
    </div>
  );
}
