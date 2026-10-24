"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon } from "@/components/icon";
import { useMoney } from "@/components/price";
import { brand } from "@/config/brand";
import { getProduct, type Poll } from "@/lib/catalog";
import { draftPoll, pollFriends } from "@/lib/polls";
import { useStored } from "@/lib/use-stored";

/** What demo friends say when they vote on your poll. */
const reasons = ["This one, no contest.", "Better reviews, and it's cheaper delivered.", "I own it. Zero regrets.", "Looks nicer in person.", "Get this one, trust me.", "The other one's fine, but this is you.", "Better for sensitive anything."];

/** Starts a poll from a set of products and opens it. */
export function useMakePoll() {
  const router = useRouter();
  const [, setMine] = useStored<Poll | null>("app.poll-mine", null);
  return (slugs: string[], question = "Which one should I get?") => {
    setMine(draftPoll(slugs, question));
    router.push("/poll/mine");
  };
}

/** "This or that?": friends vote with one tap and say why; the asker sees the winner and buys it. */
export function PollScreen({ fixture }: { fixture: Poll | null }) {
  const money = useMoney();
  const [mine] = useStored<Poll | null>("app.poll-mine", null);
  const [votes, setVotes] = useStored<Record<string, number>>("app.poll-votes", {});
  const [arrived, setArrived] = useState(0);
  const [shared, setShared] = useState(false);
  const [draft, setDraft] = useState("");
  const [said, setSaid] = useState<string[]>([]);
  const poll = fixture ?? mine;
  const own = !fixture;

  // Demo only: after you share your own poll, friends' votes come in one by one.
  useEffect(() => {
    if (!shared || arrived >= pollFriends.length) return;
    const t = setTimeout(() => setArrived((n) => n + 1), 1100);
    return () => clearTimeout(t);
  }, [shared, arrived]);

  if (!poll) {
    return (
      <div className="mx-auto max-w-[520px] px-5 pt-24 text-center">
        <h1 className="font-display text-2xl font-bold">No poll yet</h1>
        <p className="mt-1 text-sm text-ink-2">Compare two or three products, then tap Ask friends.</p>
        <Link href="/compare" className="mt-4 inline-flex h-11 items-center rounded-full bg-white px-5 text-sm font-bold text-black">
          Open Compare
        </Link>
      </div>
    );
  }

  const picked = votes[poll.id];
  const options = poll.options.map((o, i) => {
    const extra = own ? pollFriends.slice(0, arrived).filter((_, f) => (f * 5 + 1) % poll.options.length === i) : [];
    return { ...o, product: getProduct(o.slug), votes: o.votes + extra.length + (picked === i ? 1 : 0), voters: [...o.voters, ...extra.map((f) => f.avatar)] };
  });
  const total = options.reduce((n, o) => n + o.votes, 0);
  const friendNotes = own
    ? pollFriends.slice(0, arrived).map((f, k) => ({ name: f.name, avatar: f.avatar, text: reasons[k % reasons.length], pick: (k * 5 + 1) % poll.options.length }))
    : [];
  const lead = options.reduce((best, o, i) => (o.votes > options[best].votes ? i : best), 0);
  const showResults = picked !== undefined || own;
  const cols = options.length === 2 ? "grid-cols-2" : "grid-cols-3";

  async function share() {
    const url = `${window.location.origin}/poll/${poll!.id}`;
    try {
      if (navigator.share) await navigator.share({ title: brand.name, text: poll!.question, url });
      else await navigator.clipboard.writeText(url);
    } catch {
      // Dismissed: the demo still shows votes arriving.
    }
    setShared(true);
  }

  return (
    <div className="mx-auto max-w-[620px] px-3.5 pt-safe pb-36 lg:pt-6 lg:pb-16">
      <header className="flex items-center gap-3 pt-2 pb-4 lg:pt-0">
        <Link href={own ? "/compare" : "/discover"} aria-label="Back" className="glass grid size-11 shrink-0 place-items-center rounded-full">
          <Icon name="back" className="size-5" />
        </Link>
        <h1 className="flex-1 font-display text-xl font-bold">Ask friends</h1>
        <button type="button" onClick={share} aria-label="Share poll" className="glass grid size-11 place-items-center rounded-full">
          <Icon name="share" className="size-5" />
        </button>
      </header>

      <section aria-labelledby="poll-q" className="glass rounded-[30px] p-4">
        <div className="flex items-center gap-2.5">
          {poll.avatar ? (
            <Image src={poll.avatar} alt="" width={36} height={36} sizes="36px" className="size-9 rounded-full object-cover" />
          ) : (
            <span className="grid size-9 place-items-center rounded-full bg-white/15 text-sm font-bold">{poll.by[0]}</span>
          )}
          <p className="text-[13px] text-ink-2">
            <b className="text-ink">{poll.by}</b> {own ? "asked" : "asks"} · {total} {total === 1 ? "vote" : "votes"} · ends in {poll.hoursLeft} h
          </p>
        </div>
        <h2 id="poll-q" className="mt-3 font-display text-[24px] leading-tight font-extrabold tracking-[-0.02em]">
          {poll.question}
        </h2>

        <ul className={`mt-4 grid gap-2 ${cols}`}>
          {options.map((o, i) => {
            const pct = total ? o.votes / total : 0;
            if (!o.product) return null;
            return (
              <li key={o.slug}>
                <button
                  type="button"
                  disabled={own}
                  aria-pressed={picked === i}
                  onClick={() => setVotes({ ...votes, [poll.id]: i })}
                  className={`group relative block w-full overflow-hidden rounded-[20px] text-left ring-2 transition-[box-shadow] ${picked === i ? "ring-white" : "ring-transparent"}`}
                >
                  <span className="relative block aspect-[3/4]">
                    <Image src={o.product.images[0]} alt="" fill sizes="(min-width: 620px) 200px, 33vw" className="object-cover" />
                    <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/10 to-transparent" />
                    {showResults && (
                      <span aria-hidden="true" className="absolute inset-x-0 bottom-0 bg-white/18 backdrop-blur-[2px] transition-[height] duration-700 ease-soft" style={{ height: `${pct * 100}%` }} />
                    )}
                    {showResults && i === lead && total > 0 && (
                      <span className="absolute top-2 left-2 flex h-6 items-center gap-1 rounded-full bg-save px-2 text-[10.5px] font-extrabold text-black">
                        <Icon name="trophy" className="size-3.5" />
                        LEADING
                      </span>
                    )}
                    <span className="absolute inset-x-2.5 bottom-2.5">
                      {showResults && <b className="block font-display text-[26px] leading-none font-black text-legible">{Math.round(pct * 100)}%</b>}
                      <span className="mt-1 line-clamp-2 text-xs leading-snug font-semibold text-legible">{o.product.title}</span>
                      <span className="text-[11px] font-semibold text-white/80">{o.product.price === undefined ? "Quote" : money(o.product.price)}</span>
                    </span>
                  </span>
                </button>
                {o.voters.length > 0 && (
                  <span className="mt-1.5 flex -space-x-1.5 px-1">
                    {o.voters.slice(0, 5).map((v, k) => (
                      <Image key={k} src={v} alt="" width={20} height={20} sizes="20px" className="size-5 rounded-full object-cover ring-2 ring-canvas" />
                    ))}
                  </span>
                )}
              </li>
            );
          })}
        </ul>

        {!own && picked === undefined && <p className="mt-3 text-center text-xs text-ink-2">Tap one to vote. No sign-up needed.</p>}
        {own && !shared && (
          <button type="button" onClick={share} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-full bg-white text-[15px] font-bold text-black">
            <Icon name="share" className="size-5" />
            Send to friends
          </button>
        )}
        {own && shared && arrived < pollFriends.length && <p className="mt-3 text-center text-xs text-ink-2 motion-safe:animate-breathe">Votes coming in…</p>}
        {(picked !== undefined || (own && total > 0)) && options[lead].product && (
          <Link href={`/p/${options[lead].product!.slug}`} className="mt-4 flex h-12 items-center justify-center gap-2 rounded-full bg-accent text-[15px] font-bold">
            {own ? "Get the winner" : `See ${options[lead].product!.title}`}
          </Link>
        )}
      </section>

      <section aria-labelledby="why-h" className="mt-5">
        <h2 id="why-h" className="mb-2 px-1 text-[15px] font-bold">
          Why they picked it
        </h2>
        <ul className="flex flex-col gap-2">
          {[...poll.comments, ...friendNotes, ...said.map((text) => ({ name: "You", avatar: "", text, pick: picked ?? 0 }))].map((c, i) => (
            <li key={i} className="glass-inset flex gap-2.5 rounded-[20px] p-3">
              {c.avatar ? <Image src={c.avatar} alt="" width={32} height={32} sizes="32px" className="size-8 shrink-0 rounded-full object-cover" /> : <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white text-[10px] font-extrabold text-black">You</span>}
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-1.5 text-[13px]">
                  <b className="font-semibold">{c.name}</b>
                  <span className="truncate rounded-full bg-white/10 px-2 py-px text-[10.5px] font-semibold text-ink-2">picked {options[c.pick]?.product?.title.split(",")[0]}</span>
                </p>
                <p className="mt-0.5 text-sm text-ink-2">{c.text}</p>
              </div>
            </li>
          ))}
          {poll.comments.length === 0 && friendNotes.length === 0 && said.length === 0 && <li className="px-1 text-sm text-ink-3">Friends&apos; reasons show up here.</li>}
        </ul>
        {!own && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!draft.trim()) return;
              setSaid([...said, draft.trim()]);
              setDraft("");
            }}
            className="mt-3 flex gap-2"
          >
            <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={picked === undefined ? "Vote, then say why" : "Say why"} disabled={picked === undefined} className="glass-inset h-11 min-w-0 flex-1 rounded-full px-4 text-sm outline-none placeholder:text-ink-3 disabled:opacity-50" />
            <button type="submit" aria-label="Send" disabled={picked === undefined} className="grid size-11 place-items-center rounded-full bg-white text-black disabled:opacity-40">
              <Icon name="send" className="size-5" />
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
