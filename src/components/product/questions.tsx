"use client";

import { useId, useState } from "react";
import { Icon } from "@/components/icon";
import type { Question } from "@/lib/catalog";

/** Questions buyers asked, answered by the seller or other buyers, plus a box to ask your own. */
export function Questions({ questions, sellerName, replyHours }: { questions: Question[]; sellerName: string; replyHours: number }) {
  const id = useId();
  const [asked, setAsked] = useState<string[]>([]);
  const [draft, setDraft] = useState("");
  const [votes, setVotes] = useState<Record<string, boolean>>({});

  return (
    <section aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className="mb-4 font-display text-2xl font-extrabold tracking-[-0.03em]">
        Questions
      </h2>
      <ul className="flex flex-col gap-2.5">
        {asked.map((q) => (
          <li key={q} className="glass-inset rounded-[22px] p-4">
            <p className="flex gap-2.5 text-[15px] font-semibold">
              <span className="text-accent-light">Q</span>
              {q}
            </p>
            <p className="mt-2 flex items-center gap-2 pl-6 text-[13px] text-ink-2">
              <Icon name="clock" className="size-4" />
              Sent to {sellerName}. They usually reply within {replyHours} h.
            </p>
          </li>
        ))}
        {questions.map((q) => (
          <li key={q.id} className="glass-inset rounded-[22px] p-4">
            <p className="flex gap-2.5 text-[15px] font-semibold">
              <span className="text-accent-light">Q</span>
              {q.question}
            </p>
            <p className="mt-2 flex gap-2.5 text-[15px] leading-relaxed text-ink-2">
              <span className="font-semibold text-positive">A</span>
              <span>
                {q.answer}
                <span className="mt-1 flex items-center gap-2 text-xs text-ink-3">
                  {q.answeredBy === "seller" ? (
                    <span className="rounded-full bg-accent px-1.5 py-px text-[10px] font-bold tracking-wide text-white">SELLER</span>
                  ) : (
                    "A buyer"
                  )}
                  {" · "}asked by {q.asker}
                </span>
              </span>
            </p>
            <button
              type="button"
              aria-pressed={!!votes[q.id]}
              onClick={() => setVotes((v) => ({ ...v, [q.id]: !v[q.id] }))}
              className={`mt-3 ml-6 flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold ${votes[q.id] ? "bg-white text-black" : "bg-white/[0.07] text-ink-2"}`}
            >
              <Icon name="up" className="size-3.5" />
              Useful · {q.votes + (votes[q.id] ? 1 : 0)}
            </button>
          </li>
        ))}
      </ul>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const text = draft.trim();
          if (!text) return;
          setAsked((list) => [text, ...list]);
          setDraft("");
        }}
        className="mt-3 flex items-center gap-2"
      >
        <label htmlFor={`${id}-ask`} className="sr-only">
          Ask a question
        </label>
        <input
          id={`${id}-ask`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Ask ${sellerName} or past buyers`}
          maxLength={200}
          className="glass-inset h-12 min-w-0 flex-1 rounded-full px-4 text-base outline-none placeholder:text-ink-3 focus-visible:shadow-[inset_0_0_0_1.5px_rgb(255_255_255/0.6)]"
        />
        <button type="submit" disabled={!draft.trim()} className="h-12 shrink-0 rounded-full bg-accent px-5 text-[15px] font-bold disabled:opacity-40">
          Ask
        </button>
      </form>
    </section>
  );
}
