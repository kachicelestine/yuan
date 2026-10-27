import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { categoryVideosTag, commentsTag, CONTENT_TAG, FEED_TAG, questionsTag, reviewsTag, sellerReviewsTag, sellerVideosTag } from "./cache-tags";
import { services } from "./container";

// Cached reads of videos, notes, reviews and Q&A. Counters (likes, views) ride along and
// may lag by a few minutes; the person's own likes are fetched per viewer, never cached.

const content = async () => (await services()).content;

/** Every published video's id in feed order. */
export async function getFeedOrder() {
  "use cache";
  cacheLife("minutes");
  cacheTag(CONTENT_TAG, FEED_TAG);
  return (await content()).feedOrder();
}

export async function getVideosByIds(ids: string[]) {
  "use cache";
  cacheLife("minutes");
  cacheTag(CONTENT_TAG, FEED_TAG);
  return (await content()).videosByIds(ids);
}

/** The Following feed's videos. Ids arrive sorted, so the same follow list shares a cache entry. */
export async function getFollowingVideos(sellerIds: string[], authorIds: string[], offset: number, limit: number) {
  "use cache";
  cacheLife("minutes");
  cacheTag(CONTENT_TAG, FEED_TAG);
  return (await content()).videosFromSellers(sellerIds, offset, limit, authorIds);
}

export async function getSellerVideos(sellerId: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag(CONTENT_TAG, sellerVideosTag(sellerId));
  return (await content()).videosForSeller(sellerId);
}

export async function getCategoryVideos(category: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag(CONTENT_TAG, categoryVideosTag(category));
  return (await content()).videosInCategory(category);
}

export async function getNotes(category?: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag(CONTENT_TAG, "notes");
  return (await content()).notes({ category });
}

export async function getProductReviews(slug: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(CONTENT_TAG, reviewsTag(slug));
  return (await content()).reviewsForProduct(slug);
}

export async function getSellerReviews(sellerId: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(CONTENT_TAG, sellerReviewsTag(sellerId));
  return (await content()).reviewsForSeller(sellerId);
}

export async function getProductQuestions(slug: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(CONTENT_TAG, questionsTag(slug));
  return (await content()).questionsForProduct(slug);
}

/** A video's whole thread, newest first. Short-lived: people are posting into it. */
export async function getComments(videoId: string, before?: string) {
  "use cache";
  cacheLife("seconds");
  cacheTag(CONTENT_TAG, commentsTag(videoId));
  return (await content()).comments(videoId, 30, before ? new Date(before) : undefined);
}

/** Videos and photo posts with a hashtag. */
export async function getTagged(tag: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag(CONTENT_TAG, "notes");
  return (await content()).tagged(tag);
}
