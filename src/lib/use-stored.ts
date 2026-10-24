"use client";

import { useCallback, useMemo, useRef, useSyncExternalStore } from "react";

const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readRaw(key: string) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * A JSON value kept in localStorage, shared by every component that reads the same key.
 * The server render (and the first client render) sees `fallback`, so hydration matches.
 */
export function useStored<T>(key: string, fallback: T) {
  const raw = useSyncExternalStore(
    subscribe,
    () => readRaw(key),
    () => null,
  );
  const value = useMemo<T>(() => {
    if (raw === null) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
    // `fallback` is a literal at every call site; re-parsing only when the stored text changes is the point.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raw]);
  const initial = useRef(fallback);
  // Accepts a value or an updater. Updaters read what's stored right now, so several updates in
  // one tick (or from two components) build on each other instead of overwriting.
  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      let value = next as T;
      if (typeof next === "function") {
        const raw = readRaw(key);
        let prev = initial.current;
        try {
          if (raw !== null) prev = JSON.parse(raw) as T;
        } catch {
          // Corrupt entry: start again from the fallback.
        }
        value = (next as (prev: T) => T)(prev);
      }
      writeStored(key, value);
    },
    [key],
  );
  return [value, set] as const;
}

/** Writes a stored value from outside a component; every `useStored` of that key re-renders. */
export function writeStored(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Private mode or full storage: keep working without persistence.
  }
  listeners.forEach((l) => l());
}

/** Forgets a stored value; readers fall back to their defaults. */
export function removeStored(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Nothing stored, or storage is blocked: either way it's gone.
  }
  listeners.forEach((l) => l());
}

