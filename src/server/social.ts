import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import type { ProfilePageView } from "@/modules/social";
import { CONTENT_TAG, profileTag } from "./cache-tags";
import { services } from "./container";

export type PublicProfile = {
  profile: Omit<ProfilePageView, "followedByViewer" | "isViewer">;
  videos: { id: string; image: string; caption: string; views: number; likes: number }[];
  photos: { id: string; image: string; title: string; productSlug: string | null; likes: number }[];
  boards: { id: string; name: string; count: number }[];
  shops: { id: string; name: string; avatar: string }[];
  likes: number;
};

/** A person's public page: who they are, what they posted, their public collections and shop. */
export async function getProfilePage(handle: string): Promise<PublicProfile | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag(profileTag(handle), CONTENT_TAG);
  const app = await services();
  const page = await app.profiles.page(handle, null);
  if (!page) return null;
  const [videos, notes, boards, memberships] = await Promise.all([
    app.content.videosByAuthor(page.accountId, 60),
    app.content.notesByAuthor(page.accountId, 60),
    app.boards.mine(page.accountId),
    app.onboarding.memberships(page.accountId),
  ]);
  const shops = (await Promise.all(memberships.map((m) => app.catalog.getSeller(m.sellerId)))).flatMap((s) => (s ? [{ id: s.seller.id, name: s.seller.name, avatar: s.seller.avatar }] : []));
  return {
    profile: { accountId: page.accountId, handle: page.handle, name: page.name, bio: page.bio, avatar: page.avatar, followers: page.followers, following: page.following },
    videos: videos.map((v) => ({ id: v.id, image: v.image, caption: v.caption, views: v.views, likes: v.likes })),
    photos: notes.map((n) => ({ id: n.id, image: n.image, title: n.title, productSlug: n.productSlug ?? null, likes: n.likes })),
    boards: boards.filter((b) => b.public).map((b) => ({ id: b.id, name: b.name, count: b.slugs.length })),
    shops,
    likes: videos.reduce((n, v) => n + v.likes, 0) + notes.reduce((n, x) => n + x.likes, 0),
  };
}
