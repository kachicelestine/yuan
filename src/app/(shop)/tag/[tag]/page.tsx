import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Icon } from "@/components/icon";
import { compact } from "@/lib/format";
import { getTagged } from "@/server/content";

// Hashtags come from posts at any time: pages render on demand and are cached.
export function generateStaticParams() {
  return [{ tag: "solar" }];
}

/** Tags are stored lower case, letters, numbers and "_" only. */
const clean = (raw: string) => {
  const t = decodeURIComponent(raw).replace(/^#+/, "").toLowerCase();
  return /^[\p{L}\p{N}_]{1,40}$/u.test(t) ? t : null;
};

export async function generateMetadata({ params }: PageProps<"/tag/[tag]">): Promise<Metadata> {
  const tag = clean((await params).tag);
  return { title: tag ? `#${tag}` : "Hashtag" };
}

export default function TagPage({ params }: PageProps<"/tag/[tag]">) {
  return (
    <Suspense fallback={<TagSkeleton />}>
      <TagBody params={params} />
    </Suspense>
  );
}

async function TagBody({ params }: { params: PageProps<"/tag/[tag]">["params"] }) {
  const tag = clean((await params).tag);
  if (!tag) notFound();
  const { videos, notes } = await getTagged(tag);
  const views = videos.reduce((n, v) => n + v.views, 0);
  return (
    <div className="mx-auto max-w-[1100px] px-3.5 pt-safe pb-36 lg:px-6 lg:pt-6 lg:pb-16">
      <header className="flex items-center gap-3 pt-2 pb-5 lg:pt-0">
        <Link href="/discover" aria-label="Back" className="glass grid size-11 shrink-0 place-items-center rounded-full">
          <Icon name="back" className="size-5" />
        </Link>
        <span aria-hidden="true" className="glass grid size-14 shrink-0 place-items-center rounded-2xl font-display text-2xl font-extrabold">
          #
        </span>
        <div className="min-w-0">
          <h1 className="truncate font-display text-[26px] leading-tight font-extrabold tracking-[-0.03em]">#{tag}</h1>
          <p className="text-xs text-ink-2">
            {videos.length + notes.length} posts{views > 0 && ` · ${compact(views)} views`}
          </p>
        </div>
      </header>

      {videos.length > 0 && (
        <section aria-labelledby="tag-videos" className="mb-6">
          <h2 id="tag-videos" className="mb-2 px-1 text-[11px] font-bold tracking-[0.08em] text-ink-3">
            VIDEOS
          </h2>
          <ul className="grid grid-cols-3 gap-1 sm:grid-cols-4 lg:grid-cols-6">
            {videos.map((v) => (
              <li key={v.id}>
                <Link href={`/?v=${encodeURIComponent(v.id)}`} aria-label={v.caption} className="relative block aspect-[9/16] overflow-hidden rounded-xl bg-surface">
                  {v.image && <Image src={v.image} alt="" fill sizes="(min-width: 1024px) 180px, 33vw" className="object-cover" />}
                  <span className="absolute bottom-1.5 left-2 flex items-center gap-1 text-xs font-semibold text-white drop-shadow">
                    <Icon name="play" filled className="size-3.5" />
                    {compact(v.views)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {notes.length > 0 && (
        <section aria-labelledby="tag-photos">
          <h2 id="tag-photos" className="mb-2 px-1 text-[11px] font-bold tracking-[0.08em] text-ink-3">
            PHOTOS
          </h2>
          <ul className="columns-2 gap-2 sm:columns-3 lg:columns-4">
            {notes.map((n) => {
              const card = (
                <>
                  <span className={`relative block overflow-hidden ${n.ratio === "tall" ? "aspect-[3/4]" : n.ratio === "wide" ? "aspect-[4/3]" : "aspect-square"}`}>
                    <Image src={n.image} alt="" fill sizes="(min-width: 1024px) 25vw, 50vw" className="object-cover" />
                  </span>
                  <span className="line-clamp-2 px-2.5 pt-2 text-[13px] leading-snug font-semibold">{n.title}</span>
                  <span className="block truncate px-2.5 pt-1 pb-2.5 text-xs text-ink-2">{n.authorName}</span>
                </>
              );
              return (
                <li key={n.id} className="mb-2 break-inside-avoid overflow-hidden rounded-[18px] bg-surface ring-[0.5px] ring-white/10">
                  {n.productSlug ? (
                    <Link href={`/p/${n.productSlug}`} className="block">
                      {card}
                    </Link>
                  ) : (
                    card
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {!videos.length && !notes.length && (
        <p className="glass-inset rounded-[22px] p-5 text-center text-sm text-ink-2">
          Nothing tagged #{tag} yet.{" "}
          <Link href="/creator/new" className="font-semibold text-ink underline underline-offset-2">
            Be the first
          </Link>
          .
        </p>
      )}
    </div>
  );
}

function TagSkeleton() {
  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-3 px-3.5 pt-safe lg:px-6 lg:pt-6">
      <div className="skeleton mt-2 h-14 w-56 rounded-2xl" />
      <div className="grid grid-cols-3 gap-1">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="skeleton aspect-[9/16] rounded-xl" />
        ))}
      </div>
    </div>
  );
}
