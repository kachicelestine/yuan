// Cache tag names, shared by cached reads (which tag) and jobs or actions (which invalidate).
// Kept free of Next.js imports so background workers can use them too.

export const CATALOG_TAG = "catalog";
export const MARKETS_TAG = "markets";
export const productTag = (slug: string) => `product:${slug}`;
export const sellerTag = (id: string) => `seller:${id}`;
export const categoryTag = (id: string) => `category:${id}`;
