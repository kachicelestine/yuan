import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { Icon } from "@/components/icon";
import { ProfileActions } from "@/components/social/profile-actions";
import { compact } from "@/lib/format";
import { services } from "@/server/container";
import { currentAccount } from "@/server/session";
import { getProfilePage, type PublicProfile } from "@/server/social";

// Handles are made by people at any time, so pages render on demand (and are cached);
// one placeholder lets the shared shell build.
export function generateStaticParams() {
  return [{ handle: "lychee" }];
}

export async function generateMetadata({ params }: PageProps<"/u/[handle]">): Promise<Metadata> {
  const { handle } = await params;
  const page = await getProfilePage(handle.toLowerCase());
  return page ? { title: `${page.profile.name} (@${page.profile.handle})`, description: page.profile.bio || undefined } : { title: "Profile" };
}

export default function ProfilePage({ params }: PageProps<"/u/[handle]">) {
  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <ProfileBody params={params} />
    </Suspense>
  );
}

async function ProfileBody({ params }: { params: PageProps<"/u/[handle]">["params"] }) {
  const { handle } = await params;
  const data = await getProfilePage(handle.toLowerCase());
  if (!data) notFound();
  return <ProfileScreen data={data} />;
}

function ProfileScreen({ data }: { data: PublicProfile }) {
  const { profile: p, videos, boards, shops, likes } = data;
  return (
    <div className="mx-auto max-w-[860px] px-3.5 pt-safe pb-36 lg:px-6 lg:pt-6 lg:pb-16">
      <header className="flex items-center justify-between pt-2 pb-2 lg:pt-0">
        <Link href="/" aria-label="Back" className="glass grid size-11 shrink-0 place-items-center rounded-full">
          <Icon name="back" className="size-5" />
        </Link>
        <p className="truncate text-[15px] font-semibold">@{p.handle}</p>
        <span className="size-11" />
      </header>

      <section aria-label="Profile" className="flex flex-col items-center gap-3 pt-2 pb-5 text-center">
        {p.avatar ? (
          <Image src={p.avatar} alt="" width={96} height={96} sizes="96px" priority className="size-24 rounded-full object-cover ring-2 ring-white/15" />
        ) : (
          <span aria-hidden="true" className="glass grid size-24 place-items-center rounded-full font-display text-4xl font-extrabold uppercase">
            {p.name.slice(0, 1)}
          </span>
        )}
        <div>
          <h1 className="font-display text-[24px] leading-tight font-extrabold tracking-[-0.02em]">{p.name}</h1>
          {p.name !== p.handle && <p className="text-sm text-ink-2">@{p.handle}</p>}
        </div>
        {p.bio && <p className="max-w-sm text-sm whitespace-pre-line text-ink-2">{p.bio}</p>}
        {shops.length > 0 && (
          <ul className="flex flex-wrap justify-center gap-1.5">
            {shops.map((s) => (
              <li key={s.id}>
                <Link href={`/s/${s.id}`} className="glass-inset flex h-9 items-center gap-2 rounded-full pr-3.5 pl-1 text-[13px] font-semibold">
                  {s.avatar ? <Image src={s.avatar} alt="" width={28} height={28} sizes="28px" className="size-7 rounded-full object-cover" /> : <Icon name="store" className="ml-1.5 size-4" />}
                  {s.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Suspense fallback={<ProfileActions handle={p.handle} followers={p.followers} following={p.following} likes={likes} viewer={null} />}>
          <ViewerActions data={data} />
        </Suspense>
      </section>

      <section aria-labelledby="videos-h">
        <h2 id="videos-h" className="mb-2 px-1 text-[11px] font-bold tracking-[0.08em] text-ink-3">
          POSTS · {videos.length}
        </h2>
        {videos.length ? (
          <ul className="grid grid-cols-3 gap-1">
            {videos.map((v) => (
              <li key={v.id}>
                <Link href={`/?v=${encodeURIComponent(v.id)}`} aria-label={v.caption} className="relative block aspect-[3/4] overflow-hidden rounded-xl bg-surface">
                  {v.image && <Image src={v.image} alt="" fill sizes="(min-width: 860px) 280px, 33vw" className="object-cover" />}
                  <span className="absolute bottom-1.5 left-2 flex items-center gap-1 text-xs font-semibold text-white drop-shadow">
                    <Icon name="play" className="size-3.5" filled />
                    {compact(v.views)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="glass-inset rounded-[22px] p-4 text-center text-sm text-ink-2">No posts yet.</p>
        )}
      </section>

      {boards.length > 0 && (
        <section aria-labelledby="boards-h" className="mt-6">
          <h2 id="boards-h" className="mb-2 px-1 text-[11px] font-bold tracking-[0.08em] text-ink-3">
            COLLECTIONS
          </h2>
          <ul className="glass flex flex-col divide-y divide-line overflow-hidden rounded-[24px]">
            {boards.map((b) => (
              <li key={b.id}>
                <Link href={`/collections/${b.id}`} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="truncate text-sm font-semibold">{b.name}</span>
                  <span className="shrink-0 text-xs text-ink-2">{b.count} items</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

/** The part that depends on who's looking: follow state, or "Edit profile" for its owner. */
async function ViewerActions({ data }: { data: PublicProfile }) {
  await connection();
  const p = data.profile;
  const account = await currentAccount();
  const live = account ? await (await services()).profiles.page(p.handle, account.id) : null;
  const viewer = { signedIn: !!account, isSelf: live?.isViewer ?? false, followed: live?.followedByViewer ?? false };
  return <ProfileActions handle={p.handle} followers={live?.followers ?? p.followers} following={live?.following ?? p.following} likes={data.likes} viewer={viewer} />;
}

function ProfileSkeleton() {
  return (
    <div className="mx-auto flex max-w-[860px] flex-col items-center gap-3 px-3.5 pt-safe lg:px-6 lg:pt-6">
      <div className="skeleton mt-16 size-24 rounded-full" />
      <div className="skeleton h-7 w-40 rounded-xl" />
      <div className="skeleton h-4 w-28 rounded-xl" />
      <div className="skeleton mt-2 h-11 w-48 rounded-full" />
      <div className="mt-4 grid w-full grid-cols-3 gap-1">
        {Array.from({ length: 6 }, (_, i) => (
          <div key={i} className="skeleton aspect-[3/4] rounded-xl" />
        ))}
      </div>
    </div>
  );
}
