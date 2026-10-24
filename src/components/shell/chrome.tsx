"use client";

import { createContext, useContext, useMemo, useState } from "react";

type Chrome = {
  /** On the feed the tab bar rests minimized; tapping it expands it until the next swipe. */
  navExpanded: boolean;
  setNavExpanded: (expanded: boolean) => void;
};

const ChromeContext = createContext<Chrome | null>(null);

/** UI state shared between the shell (tab bar) and the page it frames. */
export function ChromeProvider({ children }: { children: React.ReactNode }) {
  const [navExpanded, setNavExpanded] = useState(false);
  const value = useMemo(() => ({ navExpanded, setNavExpanded }), [navExpanded]);
  return <ChromeContext.Provider value={value}>{children}</ChromeContext.Provider>;
}

export function useChrome() {
  const chrome = useContext(ChromeContext);
  if (!chrome) throw new Error("useChrome must be used inside <ChromeProvider>");
  return chrome;
}

