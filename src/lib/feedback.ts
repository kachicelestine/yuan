// Small bits of physical feedback shared across the app.

/** A short buzz on phones that support it (Android); silently does nothing elsewhere. */
export function haptic(pattern: number | number[] = 10) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // Some browsers throw when vibration is blocked by policy.
  }
}

/** Tells the fly-to-bag layer that something just went into the bag. */
export function announceAdd(image: string) {
  window.dispatchEvent(new CustomEvent("app:add", { detail: { image } }));
}
