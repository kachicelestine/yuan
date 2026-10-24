/**
 * The image widths and qualities the app uses. next.config.ts builds srcsets from these,
 * the loader picks qualities from them, and the /img route serves nothing else, so the
 * photo cache can't be flooded with arbitrary variants.
 */

/** Phone widths first, capped at 1080: a 3x phone gets 1080 px at lower quality, which looks the same and is half the bytes. */
export const DEVICE_SIZES = [390, 640, 750, 828, 1080];
export const IMAGE_SIZES = [32, 48, 64, 96, 128, 256, 384];
export const QUALITIES = [50, 55, 60, 72];

/** The crop parameters a stored photo URL may carry (see `photo()` in ./images). */
export const CROP_PARAMS = ["ar", "fit", "crop", "fp-x", "fp-y", "fp-z"] as const;

/** Bigger renditions only go to dense screens, where lower quality doesn't show and the bytes do. */
export function defaultQuality(width: number) {
  if (width <= 640) return 72;
  if (width <= 828) return 60;
  return 50;
}
