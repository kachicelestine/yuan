"use client";

import Image from "next/image";
import Link from "next/link";
import { useId, useState } from "react";
import { Icon, VerifiedBadge, type IconName } from "@/components/icon";
import { useStore } from "@/components/providers";
import { ReportForm } from "@/components/report/report-form";
import { FollowPerson } from "@/components/social/follow-person";
import { usePeopleFollowing } from "@/components/social/use-people-following";
import type { Comment, Seller, Video } from "@/lib/catalog";
import { compact } from "@/lib/format";
import { postCommentAction, reactAction, shareAction } from "@/server/actions/content";

type Props = {
  video: Video;
  seller: Seller;
  /** The person who posted it, when it wasn't the shop. */
  creator?: { handle: string; name: string; avatar: string };
  liked: boolean;
  /** Likes on the video, counting yours. */
  likes: number;
  onLike: () => void;
  followed: boolean;
  onFollow: () => void;
  draft: string;
  onDraft: (text: string) => void;
  composer: React.RefObject<HTMLInputElement | null>;
  onReply: (name: string) => void;
};

/** Social: reactions, the creator, and the conversation under the video. */
export function SocialTab({ video, seller, creator, liked, likes, onLike, followed, onFollow, draft, onDraft, composer, onReply }: Props) {
  const id = useId();
  const { account } = useStore();
  const people = usePeopleFollowing(!!account && !!creator);
  const [posted, setPosted] = useState<Comment[]>([]);
  // The top few arrive with the video; "View all" swaps in the whole thread, newest first.
  const [thread, setThread] = useState<{ comments: Comment[]; more: boolean } | null>(null);
  const [loadingThread, setLoadingThread] = useState(false);
  const [hearts, setHearts] = useState<Record<string, boolean>>({});
  const [shared, setShared] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [reporting, setReporting] = useState<string | null>(null);
  const shown = thread ? thread.comments : video.topComments;
  const mine = new Set(posted.map((c) => c.id));
  const comments = [...posted, ...shown.filter((c) => !c.id || !mine.has(c.id))].map((comment, i) => ({ key: comment.id ?? `top-${i}`, comment }));
  const total = video.comments + posted.length;

  async function loadThread(before?: string) {
    setLoadingThread(true);
    try {
      const res = await fetch(`/api/videos/${encodeURIComponent(video.id)}/comments${before ? `?before=${encodeURIComponent(before)}` : ""}`);
      if (!res.ok) return;
      const { comments: page } = (await res.json()) as { comments: Comment[] };
      setThread((t) => ({ comments: [...(before && t ? t.comments : []), ...page], more: page.length >= 30 }));
    } finally {
      setLoadingThread(false);
    }
  }

  async function share() {
    const url = `${location.origin}/?v=${encodeURIComponent(video.id)}`;
    try {
      if (navigator.share) await navigator.share({ text: video.caption, url });
      else await navigator.clipboard.writeText(url);
      if (!shared) void shareAction(video.id);
      setShared(true);
    } catch {
      // Dismissed share sheet or blocked clipboard: nothing to undo.
    }
  }

  async function post(event: React.FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text || sending) return;
    setError(null);
    setSending(true);
    const r = await postCommentAction(video.id, text);
    setSending(false);
    if (!r.ok) return setError(r.message);
    setPosted((list) => [{ ...r.comment, name: "You" }, ...list]);
    onDraft("");
  }

  function heart(key: string, comment: Comment) {
    const on = !hearts[key];
    setHearts((prev) => ({ ...prev, [key]: on }));
    if (account && comment.id) void reactAction({ target: "comment", id: comment.id, on });
  }

  return (
    <div className="flex min-h-full flex-col gap-4 px-4 pt-1">
      <div className="grid grid-cols-3 gap-2">
        <Stat icon="heart" label="Like" count={compact(likes)} pressed={liked} tone="text-like" onClick={onLike} />
        <Stat icon="comment" label="Comment" count={compact(total)} onClick={() => composer.current?.focus()} />
        <Stat icon="share" label={shared ? "Shared" : "Share"} count={compact(video.shares + (shared ? 1 : 0))} onClick={share} />
      </div>

      {creator && (
        <div className="glass-inset flex items-center gap-3 rounded-[20px] p-2.5">
          <Link href={`/u/${creator.handle}`} className="flex min-w-0 flex-1 items-center gap-3">
            {creator.avatar ? (
              <Image src={creator.avatar} alt="" width={44} height={44} sizes="44px" className="size-11 shrink-0 rounded-full object-cover" />
            ) : (
              <span aria-hidden="true" className="glass grid size-11 shrink-0 place-items-center rounded-full font-display text-lg font-extrabold uppercase">
                {creator.name.slice(0, 1)}
              </span>
            )}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-semibold">{creator.name}</span>
              <span className="block truncate text-xs text-ink-2">Posted by @{creator.handle}</span>
            </span>
          </Link>
          {account && !people ? (
            <span aria-hidden="true" className="skeleton h-9 w-24 rounded-full" />
          ) : (
            people?.me !== creator.handle && (
              <FollowPerson key={`${creator.handle}:${people?.handles.has(creator.handle)}`} handle={creator.handle} initial={!!people?.handles.has(creator.handle)} signedIn={!!account} size="sm" />
            )
          )}
        </div>
      )}

      <div className="glass-inset flex items-center gap-3 rounded-[20px] p-2.5">
        <Link href={`/s/${seller.id}`} className="flex min-w-0 flex-1 items-center gap-3">
        <Image src={seller.avatar} alt="" width={44} height={44} sizes="44px" className="size-11 shrink-0 rounded-full object-cover" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5 text-[15px] font-semibold">
            <span className="truncate">{seller.name}</span>
            {seller.verified && <VerifiedBadge />}
          </span>
          <span className="block truncate text-xs text-ink-2">
            {seller.kind} · {seller.city}
          </span>
        </span>
        </Link>
        <button
          type="button"
          onClick={onFollow}
          className={`h-9 shrink-0 rounded-full px-4 text-[13px] font-bold transition-colors ${followed ? "glass-inset text-ink-2" : "bg-accent text-white"}`}
        >
          {followed ? "Following" : "Follow"}
        </button>
      </div>

      <section aria-labelledby={`${id}-comments`}>
        <h3 id={`${id}-comments`} className="text-[13px] font-semibold text-ink-2">
          {total.toLocaleString("en-US")} comments
        </h3>
        <ul>
          {comments.map(({ key, comment }) => {
            const on = !!hearts[key];
            return (
              <li key={key} className="flex gap-3 py-3">
                {comment.avatar ? (
                  <Image src={comment.avatar} alt="" width={36} height={36} sizes="36px" className="size-9 shrink-0 rounded-full object-cover" />
                ) : (
                  <span className="glass-inset grid size-9 shrink-0 place-items-center rounded-full">
                    <Icon name="user" className="size-[18px]" />
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 text-[13px] font-semibold text-ink-2">
                    {comment.name}
                    {comment.seller && <span className="rounded-full bg-accent px-1.5 py-px text-[10px] font-bold tracking-wide text-white">SELLER</span>}
                  </p>
                  <p className="mt-0.5 text-[15px] leading-snug">{comment.text}</p>
                  <p className="mt-1 flex items-center gap-3 text-xs text-ink-3">
                    {comment.ago}
                    <button type="button" onClick={() => onReply(comment.name)} className="py-1 font-semibold text-ink-2">
                      Reply
                    </button>
                    {comment.id && !mine.has(comment.id) && (
                      <button type="button" aria-expanded={reporting === comment.id} onClick={() => setReporting(reporting === comment.id ? null : comment.id!)} className="py-1 text-ink-3">
                        Report
                      </button>
                    )}
                  </p>
                  {reporting === comment.id && comment.id && (
                    <div className="glass-inset -mx-1 mt-1 rounded-2xl">
                      <ReportForm targetType="comment" targetId={comment.id} />
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => heart(key, comment)}
                  aria-pressed={on}
                  aria-label={`Like comment from ${comment.name}`}
                  className={`flex w-9 shrink-0 flex-col items-center gap-0.5 pt-1 text-[11px] font-semibold ${on ? "text-like" : "text-ink-3"}`}
                >
                  <Icon name="heart" filled={on} className={`size-[18px] ${on ? "motion-safe:animate-pop" : ""}`} />
                  {compact(comment.likes + (on ? 1 : 0))}
                </button>
              </li>
            );
          })}
        </ul>
        {(thread ? thread.more : total > shown.length + posted.length) && (
          <button
            type="button"
            disabled={loadingThread}
            onClick={() => void loadThread(thread?.comments.at(-1)?.at)}
            className="glass-inset mt-1 h-10 w-full rounded-full text-[13px] font-semibold text-ink-2 disabled:opacity-60"
          >
            {loadingThread ? "Loading…" : thread ? "More comments" : `View all ${total.toLocaleString("en-US")} comments`}
          </button>
        )}
      </section>

      <form onSubmit={post} className="edge-bottom pb-safe sticky bottom-0 -mx-4 mt-auto flex flex-wrap items-center gap-2 px-4 pt-5">
        {!account && (
          <p className="w-full text-xs text-ink-2">
            <Link href="/signin?next=/" className="font-semibold text-ink underline underline-offset-2">
              Sign in
            </Link>{" "}
            to comment.
          </p>
        )}
        {error && (
          <p role="alert" className="w-full text-xs text-like">
            {error}
          </p>
        )}
        <label htmlFor={`${id}-say`} className="sr-only">
          Add a comment
        </label>
        {/* 16px text, so iOS doesn't zoom the page when the field gets focus. */}
        <input
          ref={composer}
          id={`${id}-say`}
          value={draft}
          onChange={(event) => onDraft(event.target.value)}
          placeholder="Add a comment…"
          maxLength={300}
          enterKeyHint="send"
          autoComplete="off"
          className="glass-inset h-11 min-w-0 flex-1 rounded-full px-4 text-base outline-none placeholder:text-ink-3 focus-visible:shadow-[inset_0_0_0_1.5px_rgb(255_255_255/0.6)]"
        />
        <button type="submit" disabled={!draft.trim() || sending || !account} aria-label="Post comment" className="grid size-11 shrink-0 place-items-center rounded-full bg-accent transition-opacity disabled:opacity-40">
          <Icon name="send" className="size-5" />
        </button>
      </form>
    </div>
  );
}

function Stat({
  icon,
  label,
  count,
  pressed,
  tone = "",
  onClick,
}: {
  icon: IconName;
  label: string;
  count: string;
  pressed?: boolean;
  tone?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      aria-label={`${label}, ${count}`}
      className="glass-inset flex h-[60px] flex-col items-center justify-center gap-0.5 rounded-[18px] text-xs font-semibold text-ink-2"
    >
      <span className="flex items-center gap-1.5 font-display text-[15px] font-bold text-ink">
        <Icon name={icon} filled={pressed} className={`size-5 ${pressed ? `${tone} motion-safe:animate-pop` : ""}`} />
        {count}
      </span>
      {label}
    </button>
  );
}

