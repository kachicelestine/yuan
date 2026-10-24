"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { isPaletteShortcut } from "./palette-shortcut";

// The palette and the search data it needs aren't part of any page's first load.
const CommandPalette = dynamic(() => import("./command-palette").then((m) => m.CommandPalette), { ssr: false });
const warm = () => import("./command-palette");

/**
 * Stands in for the command palette until it's first wanted: catches the shortcut or the
 * "app:palette" event, then loads the palette, which opens itself. The code is fetched
 * in the background once the page is idle, so even the first open is instant.
 */
export function CommandPaletteLoader() {
  const [wanted, setWanted] = useState(false);

  useEffect(() => {
    if (wanted) return;
    const want = () => setWanted(true);
    const onKey = (e: KeyboardEvent) => {
      if (!isPaletteShortcut(e)) return;
      e.preventDefault();
      want();
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("app:palette", want);
    const idle = "requestIdleCallback" in window ? requestIdleCallback(() => void warm(), { timeout: 8000 }) : undefined;
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("app:palette", want);
      if (idle !== undefined) cancelIdleCallback(idle);
    };
  }, [wanted]);

  return wanted ? <CommandPalette openOnMount /> : null;
}
