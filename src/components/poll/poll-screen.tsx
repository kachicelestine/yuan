"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Icon } from "@/components/icon";
import { useMoney } from "@/components/price";
import { brand } from "@/config/brand";
import { capDensity } from "@/lib/images";
import type { PollView } from "@/modules/engagement";
import { createPollAction, votePollAction } from "@/server/actions/polls";

type ProductInfo = { title: string; image: string; price: number | null };

/** Starts a poll from a set of products and opens it (signing in first if needed). */
export function useMakePoll() {
  const router = useRouter();
  return async (slugs: string[], question = "Which one should I get?") => {
    const r = await createPollAction(slugs, question);
    if (r.ok) return router.push(`/poll/${r.id}`);
    if (r.code === "sign_in_required") return router.push(`/signin?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    window.alert(r.message);
  };
}

const left = (endsAt: string) => {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return "closed";
  const h = Math.floor(ms / 3_600_000);
  return h >= 1 ? `ends in ${h} h` : `ends in ${Math.max(1, Math.round(ms / 60_000))} min`;
};

/** "This or that?": friends vote with one tap and say why; the asker sees the winner and buys it. */
export function PollScreen({ initial, products }: { initial: PollView; products: Record<string, ProductInfo> }) {
  const money = useMoney();
  const [poll, setPoll] = useState(initial);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, start] = useTransition();
  const [, tick] = useState(0);

  // Votes arrive while it's open: refresh every few seconds while the page is visible.
  useEffect(() => {
    if (!poll.open) return;
    const t = setInterval(() => {
      tick((n) => n + 1);
      if (document.visibilityState !== "visible") return;
      fetch(`/api/polls/${poll.id}`, { cache: "no-store" })
        .then((r) => (r.ok ? (r.json() as Promise<PollView>) : null))
        .then((p) => p && setPoll(p))
        .catch(() => {});
    }, 5000);
    return () => clearInterval(t);
  }, [poll.id, poll.open]);

  const picked = poll.myVote;
  const total = poll.total;
  const lead = poll.options.reduce((best, o, i) => (o.votes > poll.options[best].votes ? i : best), 0);
  const showResults = picked !== null || poll.yours || !poll.open;
  const cols = poll.options.length === 2 ? "grid-cols-2" : "grid-cols-3";
  const titleOf = (i: number) => products[poll.options[i]?.slug]?.title.split(",")[0] ?? "";

  const vote = (choice: number, reason: string | null = null) =>
    start(async () => {
      const r = await votePollAction(poll.id, choice, reason);
      if (!r.ok) return setError(r.message);
      setError(null);
      setPoll(r.poll);
    });

  async function share() {
    const url = `${window.location.origin}/poll/${poll.id}`;
    try {
      if (navigator.share) await navigator.share({ title: brand.name, text: poll.question, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
      }
    } catch {
      // Dismissed.
    }
  }

  return (
    <div className="mx-auto max-w-[620px] px-3.5 pt-safe pb-36 lg:pt-6 lg:pb-16">
      <header className="flex items-center gap-3 pt-2 pb-4 lg:pt-0">
        <Link href={poll.yours ? "/compare" : "/discover"} aria-label="Back" className="glass grid size-11 shrink-0 place-items-center rounded-full">
          <Icon name="back" className="size-5" />
        </Link>
        <h1 className="flex-1 font-display text-xl font-bold">Ask friends</h1>
        <button type="button" onClick={share} aria-label="Share poll" className="glass grid size-11 place-items-center rounded-full">
          <Icon name="share" className="size-5" />
        </button>
      </header>

      <section aria-labelledby="poll-q" className="glass rounded-[30px] p-4">
        <div className="flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-full bg-white/15 text-sm font-bold">{poll.by[0]?.toUpperCase()}</span>
          <p className="text-[13px] text-ink-2">
            <b className="text-ink">{poll.yours ? "You" : poll.by}</b> {poll.yours ? "asked" : "asks"} · {total} {total === 1 ? "vote" : "votes"} · {left(poll.endsAt)}
          </p>
        </div>
        <h2 id="poll-q" className="mt-3 font-display text-[24px] leading-tight font-extrabold tracking-[-0.02em]">
          {poll.question}
        </h2>

        <ul className={`mt-4 grid gap-2 ${cols}`}>
          {poll.options.map((o, i) => {
            const product = products[o.slug];
            const pct = total ? o.votes / total : 0;
            if (!product) return null;
            return (
              <li key={o.slug}>
                <button
                  type="button"
                  disabled={poll.yours || !poll.open || busy}
                  aria-pressed={picked === i}
                  onClick={() => vote(i)}
                  className={`group relative block w-full overflow-hidden rounded-[20px] text-left ring-2 transition-[box-shadow] ${picked === i ? "ring-white" : "ring-transparent"}`}
                >
                  <span className="relative block aspect-[3/4]">
                    <Image src={product.image} alt="" fill sizes={capDensity("(min-width: 620px) 200px, 33vw")} className="object-cover" />
                    <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
                    {showResults && (
                      <span aria-hidden="true" className="absolute inset-x-0 bottom-0 bg-white/18 backdrop-blur-[2px] transition-[height] duration-700 ease-soft" style={{ height: `${pct * 100}%` }} />
                    )}
                    {showResults && i === lead && total > 0 && (
                      <span className="absolute top-2 left-2 flex h-6 items-center gap-1 rounded-full bg-save px-2 text-[10.5px] font-extrabold text-black">
                        <Icon name="trophy" className="size-3.5" />
                        {poll.open ? "LEADING" : "WINNER"}
                      </span>
                    )}
                    <span className="absolute inset-x-2.5 bottom-2.5">
                      {showResults && <b className="block font-display text-[26px] leading-none font-black text-legible">{Math.round(pct * 100)}%</b>}
                      <span className="mt-1 line-clamp-2 text-xs leading-snug font-semibold text-legible">{product.title}</span>
                      <span className="text-[11px] font-semibold text-white/80">{product.price === null ? "Quote" : money(product.price)}</span>
                    </span>
                  </span>
                </button>
                {o.voters.length > 0 && (
                  <span className="mt-1.5 flex -space-x-1.5 px-1" aria-label={`Voted for by ${o.voters.join(", ")}`}>
                    {o.voters.map((name, k) => (
                      <span key={k} className="grid size-5 place-items-center rounded-full bg-white/80 text-[9px] font-extrabold text-black ring-2 ring-canvas">
                        {name[0]?.toUpperCase()}
                      </span>
                    ))}
                  </span>
                )}
              </li>
            );
          })}
        </ul>

        {!poll.yours && poll.open && picked === null && <p className="mt-3 text-center text-xs text-ink-2">Tap one to vote. No sign-up needed.</p>}
        {!poll.open && <p className="mt-3 text-center text-xs text-ink-2">This poll has closed.</p>}
        {error && (
          <p role="alert" className="mt-3 text-center text-xs font-semibold text-like">
            {error}
          </p>
        )}
        {poll.yours && poll.open && (
          <button type="button" onClick={share} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white text-[15px] font-bold text-black">
            <Icon name="share" className="size-5" />
            {copied ? "Link copied: send it to friends" : "Send to friends"}
          </button>
        )}
        {poll.yours && poll.open && total === 0 && <p className="mt-3 text-center text-xs text-ink-2">Votes show up here as friends answer.</p>}
        {(picked !== null || (poll.yours && total > 0) || !poll.open) && total > 0 && products[poll.options[lead].slug] && (
          <Link href={`/p/${poll.options[lead].slug}`} className="mt-4 flex h-12 items-center justify-center gap-2 rounded-full bg-accent text-[15px] font-bold">
            {poll.yours ? "Get the winner" : `See ${titleOf(lead)}`}
          </Link>
        )}
      </section>

      <section aria-labelledby="why-h" className="mt-5">
        <h2 id="why-h" className="mb-2 px-1 text-[15px] font-bold">
          Why they picked it
        </h2>
        <ul className="flex flex-col gap-2">
          {poll.comments.map((c, i) => (
            <li key={i} className="glass-inset flex gap-2.5 rounded-[20px] p-3">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white text-[11px] font-extrabold text-black">{c.name[0]?.toUpperCase()}</span>
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-1.5 text-[13px]">
                  <b className="font-semibold">{c.name}</b>
                  <span className="truncate rounded-full bg-white/10 px-2 py-px text-[10.5px] font-semibold text-ink-2">picked {titleOf(c.pick)}</span>
                </p>
                <p className="mt-0.5 text-sm text-ink-2">{c.text}</p>
              </div>
            </li>
          ))}
          {poll.comments.length === 0 && <li className="px-1 text-sm text-ink-3">Friends&apos; reasons show up here.</li>}
        </ul>
        {!poll.yours && poll.open && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!draft.trim() || picked === null) return;
              vote(picked, draft.trim());
              setDraft("");
            }}
            className="mt-3 flex gap-2"
          >
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              maxLength={200}
              aria-label="Why"
              placeholder={picked === null ? "Vote, then say why" : "Say why"}
              disabled={picked === null}
              className="glass-inset h-11 min-w-0 flex-1 rounded-full px-4 text-sm outline-none placeholder:text-ink-3 disabled:opacity-50"
            />
            <button type="submit" aria-label="Send" disabled={picked === null || busy} className="grid size-11 place-items-center rounded-full bg-white text-black disabled:opacity-40">
              <Icon name="send" className="size-5" />
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
