"use client";

import { useMemo, useSyncExternalStore } from "react";

/**
 * The current time, rounded down to `step` ms so renders between ticks agree.
 * Null on the server and during hydration, so time-dependent text never mismatches.
 */
export function useNow(step = 60_000) {
  const subscribe = useMemo(
    () => (onTick: () => void) => {
      const t = setInterval(onTick, step);
      return () => clearInterval(t);
    },
    [step],
  );
  return useSyncExternalStore(
    subscribe,
    () => Math.floor(Date.now() / step) * step,
    () => null,
  );
}
