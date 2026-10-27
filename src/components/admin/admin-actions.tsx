"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

type Done = { ok: true } | { ok: false; message: string };
type Tone = "danger" | "plain" | "good";

const TONES: Record<Tone, string> = {
  danger: "bg-like/15 text-like",
  plain: "bg-white/10 text-ink-2",
  good: "bg-positive/20 text-positive",
};

function useRun() {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (work: () => Promise<Done>, after?: () => void) =>
    start(async () => {
      setError(null);
      const r = await work();
      if (!r.ok) return setError(r.message);
      after?.();
      router.refresh();
    });
  return { pending, error, run };
}

function ErrorLine({ message }: { message: string | null }) {
  return message ? (
    <p role="alert" className="basis-full text-xs text-like">
      {message}
    </p>
  ) : null;
}

/** One click, then "Sure?" to confirm: for decisions that need no explanation. */
export function ConfirmButton({ label, action, tone = "plain", confirm = "Sure?" }: { label: string; action: () => Promise<Done>; tone?: Tone; confirm?: string }) {
  const { pending, error, run } = useRun();
  const [armed, setArmed] = useState(false);
  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => (armed ? run(action, () => setArmed(false)) : setArmed(true))}
        onBlur={() => setArmed(false)}
        className={`h-8 rounded-full px-3 text-xs font-bold disabled:opacity-50 ${TONES[tone]}`}
      >
        {pending ? "…" : armed ? confirm : label}
      </button>
      <ErrorLine message={error} />
    </>
  );
}

/** Opens a one-line note to say why (the other side sees it), then confirms. */
export function ReasonButton({ label, action, placeholder, tone = "danger" }: { label: string; action: (reason: string) => Promise<Done>; placeholder: string; tone?: Tone }) {
  const { pending, error, run } = useRun();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className={`h-8 rounded-full px-3 text-xs font-bold ${TONES[tone]}`}>
        {label}
      </button>
    );
  return (
    <form
      className="flex basis-full flex-wrap gap-1.5"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () => action(reason),
          () => {
            setOpen(false);
            setReason("");
          },
        );
      }}
    >
      <input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder={placeholder} aria-label={placeholder} maxLength={500} className="glass-inset h-9 min-w-0 flex-1 rounded-full px-3.5 text-sm outline-none placeholder:text-ink-3" />
      <button type="submit" disabled={pending || reason.trim().length < 5} className={`h-9 rounded-full px-3.5 text-xs font-bold disabled:opacity-50 ${TONES[tone]}`}>
        {pending ? "…" : label}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="h-9 rounded-full px-3 text-xs font-semibold text-ink-2">
        Cancel
      </button>
      <ErrorLine message={error} />
    </form>
  );
}
