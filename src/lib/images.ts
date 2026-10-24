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

/**
 * Builds an Unsplash photo key that `image-loader.ts` turns into a sized CDN URL.
 * Crops happen on the CDN, so a landscape original can fill a portrait feed slot sharply.
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
  const query = params.toString();
  return `photo-${id}${query ? `?${query}` : ""}`;
}

/** Full-height phone crop used by the vertical feed and live rooms. */
export const portrait = (id: string, fx = 0.5, fy = 0.5) => photo(id, { ar: "9:19.5", fx, fy });

export const square = (id: string, fx = 0.5, fy = 0.5) => photo(id, { ar: "1:1", fx, fy });

export const avatar = (id: string, focus?: { fx: number; fy: number; zoom: number }) =>
  focus ? photo(id, { ar: "1:1", ...focus }) : photo(id, { ar: "1:1", faces: true });

