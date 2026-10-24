type Crop = {
  /** Aspect ratio for a server-side crop, e.g. "9:19.5" or "1:1". */
  ar?: string;
  /** Focal point, 0–1 from the left / top. */
  fx?: number;
  fy?: number;
  /** Zoom into the focal point (Unsplash/imgix `fp-z`). */
  zoom?: number;
  /** Let the CDN find the face instead of using a focal point. */
  faces?: boolean;
};

/** The stored URL is a 1200 px rendition, usable as is (e.g. in a share card or an email). */
const UPSTREAM = { w: "1200", fm: "jpg", q: "80" };

/**
 * Builds an Unsplash photo URL. Unsplash does the crop, so a landscape original can fill a
 * portrait feed slot sharply; `image-loader.ts` then asks for the exact width each screen needs.
 */
export function photo(id: string, crop: Crop = {}) {
  const params = new URLSearchParams();
  if (crop.ar) {
    params.set("ar", crop.ar);
    params.set("fit", "crop");
    if (crop.faces) {
      params.set("crop", "faces");
    } else {
      params.set("crop", "focalpoint");
      params.set("fp-x", String(crop.fx ?? 0.5));
      params.set("fp-y", String(crop.fy ?? 0.5));
      if (crop.zoom) params.set("fp-z", String(crop.zoom));
    }
  }
  for (const [key, value] of Object.entries(UPSTREAM)) params.set(key, value);
  return `https://images.unsplash.com/photo-${id}?${params}`;
}

/**
 * Phones with 3x screens get grid and list images at 2x: about half the bytes, and no visible
 * difference at arm's length (Instagram's and X's feeds do the same). Adds a dense-screen
 * entry that scales the phone slot (the last entry) by two thirds. Heroes keep full density.
 */
export function capDensity(sizes: string): string {
  const entries = sizes.split(",").map((s) => s.trim());
  const phone = /^(\d+(?:\.\d+)?)(vw|px)$/.exec(entries.at(-1) ?? "");
  if (!phone) return sizes;
  const scaled = `${Math.round(((Number(phone[1]) * 2) / 3) * 10) / 10}${phone[2]}`;
  return [`(max-width: 1023px) and (min-resolution: 2.5dppx) ${scaled}`, ...entries].join(", ");
}

/**
 * The same photo cropped to another shape, e.g. a live room's full-height phone shot shown
 * in a 3:4 card. Unsplash crops around the stored focal point, so the card downloads only
 * the pixels it shows instead of a 9:19.5 image it mostly hides.
 */
export function reframe(url: string, ar: string) {
  if (!url.startsWith("https://images.unsplash.com/")) return url;
  const u = new URL(url);
  u.searchParams.set("ar", ar);
  u.searchParams.set("fit", "crop");
  return u.toString();
}

/** Full-height phone crop used by the vertical feed and live rooms. */
export const portrait = (id: string, fx = 0.5, fy = 0.5) => photo(id, { ar: "9:19.5", fx, fy });

export const square = (id: string, fx = 0.5, fy = 0.5) => photo(id, { ar: "1:1", fx, fy });

export const avatar = (id: string, focus?: { fx: number; fy: number; zoom: number }) =>
  focus ? photo(id, { ar: "1:1", ...focus }) : photo(id, { ar: "1:1", faces: true });

