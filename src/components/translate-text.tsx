"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/icon";
import { useStore } from "@/components/providers";
import { translateAction } from "@/server/actions/translate";

/** A quiet "Translate" under something a person wrote, into the language this device is set to. */
export function TranslateText({ text }: { text: string }) {
  const { translation } = useStore();
  const [translated, setTranslated] = useState<string | null>(null);
  const [showing, setShowing] = useState(false);
  const [failed, setFailed] = useState(false);
  const [busy, start] = useTransition();
  if (!translation) return null;

  function toggle() {
    if (translated) return setShowing(!showing);
    setFailed(false);
    start(async () => {
      const r = await translateAction(text, navigator.language);
      if (!r.ok) return setFailed(true);
      setTranslated(r.text);
      setShowing(true);
    });
  }

  return (
    <span className="flex flex-col items-start gap-1">
      {showing && translated && <span className="text-[14px] leading-snug whitespace-pre-wrap text-ink">{translated}</span>}
      <button type="button" disabled={busy} onClick={toggle} className="flex items-center gap-1 text-[11.5px] font-semibold text-ink-3 disabled:opacity-60">
        <Icon name="globe" className="size-3" />
        {busy ? "Translating…" : failed ? "Couldn't translate. Try again" : showing ? "Hide translation" : "Translate"}
      </button>
    </span>
  );
}
