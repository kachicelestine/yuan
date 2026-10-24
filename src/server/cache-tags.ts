// Cache tag names, shared by cached reads (which tag) and jobs or actions (which invalidate).
// Kept free of Next.js imports so background workers can use them too.

export const CATALOG_TAG = "catalog";
export const MARKETS_TAG = "markets";
export const productTag = (slug: string) => `product:${slug}`;
export const sellerTag = (id: string) => `seller:${id}`;
export const categoryTag = (id: string) => `category:${id}`;

/** Everything the content module serves (videos, notes, reviews, Q&A). */
export const CONTENT_TAG = "content";
/** The ranked feed order and its pages; dropped when a video is published or removed. */
export const FEED_TAG = "feed";
export const sellerVideosTag = (id: string) => `videos:seller:${id}`;
export const categoryVideosTag = (id: string) => `videos:category:${id}`;
export const reviewsTag = (slug: string) => `reviews:${slug}`;
export const sellerReviewsTag = (id: string) => `reviews:seller:${id}`;
export const commentsTag = (videoId: string) => `comments:${videoId}`;
export const questionsTag = (slug: string) => `questions:${slug}`;

/** The live lobby: shows starting, ending or scheduled. */
export const LIVE_TAG = "live";
