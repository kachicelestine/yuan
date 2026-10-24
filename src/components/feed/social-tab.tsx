"use client";

import Image from "next/image";
import Link from "next/link";
import { useId, useState } from "react";
import { Icon, VerifiedBadge, type IconName } from "@/components/icon";
import type { Comment, Seller, Video } from "@/lib/catalog";
import { compact } from "@/lib/format";

type Props = {
  video: Video;
  seller: Seller;
  liked: boolean;
  onLike: () => void;
  followed: boolean;
  onFollow: () => void;
  draft: string;
  onDraft: (text: string) => void;
  composer: React.RefObject<HTMLInputElement | null>;
  onReply: (name: string) => void;
};

/** Social: reactions, the creator, and the conversation under the video. */
export function SocialTab({ video, seller, liked, onLike, followed, onFollow, draft, onDraft, composer, onReply }: Props) {
  const id = useId();
  const [posted, setPosted] = useState<{ key: string; comment: Comment }[]>([]);
  const [hearts, setHearts] = useState<Record<string, boolean>>({});
  const [shared, setShared] = useState(false);
  const comments = [...posted, ...video.topComments.map((comment, i) => ({ key: `top-${i}`, comment }))];
  const total = video.comments + posted.length;

  async function share() {
    const url = `${location.origin}/p/${video.productSlug}`;
    try {
      if (navigator.share) await navigator.share({ text: video.caption, url });
      else await navigator.clipboard.writeText(url);
      setShared(true);
    } catch {
      // Dismissed share sheet or blocked clipboard: nothing to undo.
    }
  }

  function post(event: React.FormEvent) {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    setPosted((list) => [{ key: `mine-${list.length}`, comment: { name: "You", avatar: "", text, likes: 0, ago: "now" } }, ...list]);
    onDraft("");
  }

  return (
    <div className="flex min-h-full flex-col gap-4 px-4 pt-1">
      <div className="grid grid-cols-3 gap-2">
        <Stat icon="heart" label="Like" count={compact(video.likes + (liked ? 1 : 0))} pressed={liked} tone="text-like" onClick={onLike} />
        <Stat icon="comment" label="Comment" count={compact(total)} onClick={() => composer.current?.focus()} />
        <Stat icon="share" label={shared ? "Shared" : "Share"} count={compact(video.shares + (shared ? 1 : 0))} onClick={share} />
      </div>

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
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setHearts((prev) => ({ ...prev, [key]: !prev[key] }))}
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
      </section>

      <form onSubmit={post} className="edge-bottom pb-safe sticky bottom-0 -mx-4 mt-auto flex items-center gap-2 px-4 pt-5">
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
        <button type="submit" disabled={!draft.trim()} aria-label="Post comment" className="grid size-11 shrink-0 place-items-center rounded-full bg-accent transition-opacity disabled:opacity-40">
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

