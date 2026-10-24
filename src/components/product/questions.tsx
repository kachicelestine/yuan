"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { Icon } from "@/components/icon";
import { useStore } from "@/components/providers";
import type { Question } from "@/lib/catalog";
import { askQuestionAction, reactAction } from "@/server/actions/content";

type Props = { productSlug: string; questions: Question[]; sellerName: string; replyHours: number };

/** Questions buyers asked, answered by the seller or other buyers, plus a box to ask your own. */
export function Questions({ productSlug, questions, sellerName, replyHours }: Props) {
  const id = useId();
  const { account } = useStore();
  const [asked, setAsked] = useState<{ key: string; text: string }[]>([]);
  const [draft, setDraft] = useState("");
  const [votes, setVotes] = useState<Record<string, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  function vote(questionId: string) {
    const on = !votes[questionId];
    setVotes((v) => ({ ...v, [questionId]: on }));
    if (account) void reactAction({ target: "question", id: questionId, on });
  }

  async function ask(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    setError(null);
    setSending(true);
    const r = await askQuestionAction(productSlug, text);
    setSending(false);
    if (!r.ok) return setError(r.message);
    setAsked((list) => [{ key: r.question.id, text: r.question.question }, ...list]);
    setDraft("");
  }

  return (
    <section aria-labelledby={`${id}-h`}>
      <h2 id={`${id}-h`} className="mb-4 font-display text-2xl font-extrabold tracking-[-0.03em]">
        Questions
      </h2>
      <ul className="flex flex-col gap-2.5">
        {asked.map((q) => (
          <li key={q.key} className="glass-inset rounded-[22px] p-4">
            <p className="flex gap-2.5 text-[15px] font-semibold">
              <span className="text-accent-light">Q</span>
              {q.text}
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
            {q.answer && (
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
            )}
            <button
              type="button"
              aria-pressed={!!votes[q.id]}
              onClick={() => vote(q.id)}
              className={`mt-3 ml-6 flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold ${votes[q.id] ? "bg-white text-black" : "bg-white/[0.07] text-ink-2"}`}
            >
              <Icon name="up" className="size-3.5" />
              Useful · {q.votes + (votes[q.id] ? 1 : 0)}
            </button>
          </li>
        ))}
      </ul>
      <form onSubmit={ask} className="mt-3 flex flex-wrap items-center gap-2">
        <label htmlFor={`${id}-ask`} className="sr-only">
          Ask a question
        </label>
        <input
          id={`${id}-ask`}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Ask ${sellerName} or past buyers`}
          maxLength={300}
          disabled={!account}
          className="glass-inset h-12 min-w-0 flex-1 rounded-full px-4 text-base outline-none placeholder:text-ink-3 focus-visible:shadow-[inset_0_0_0_1.5px_rgb(255_255_255/0.6)] disabled:opacity-60"
        />
        <button type="submit" disabled={!draft.trim() || sending || !account} className="h-12 shrink-0 rounded-full bg-accent px-5 text-[15px] font-bold disabled:opacity-40">
          {sending ? "Sending…" : "Ask"}
        </button>
        {!account && (
          <p className="w-full px-1 text-xs text-ink-2">
            <Link href={`/signin?next=${encodeURIComponent(`/p/${productSlug}`)}`} className="font-semibold text-ink underline underline-offset-2">
              Sign in
            </Link>{" "}
            to ask {sellerName} a question.
          </p>
        )}
        {error && (
          <p role="alert" className="w-full px-1 text-xs text-like">
            {error}
          </p>
        )}
      </form>
    </section>
  );
}
