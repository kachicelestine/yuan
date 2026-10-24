"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/icon";

// The Web Speech API isn't in TypeScript's DOM types, so this is the slice we use.
type Recognition = {
  lang: string;
  interimResults: boolean;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
};
type RecognitionCtor = new () => Recognition;

/** Without speech recognition (or permission), this plays a sample request so the flow still shows. */
const demo = "solar panels under 100 dollars";

/** Voice search: speak, watch the words appear, then search. */
export function VoiceSearch({ open, onClose, onResult }: { open: boolean; onClose: () => void; onResult: (text: string) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const recognition = useRef<Recognition | null>(null);
  const [text, setText] = useState("");
  const [state, setState] = useState<"listening" | "done">("listening");

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
    if (!open) return;

    const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    let fallback: ReturnType<typeof setInterval> | undefined;
    const playDemo = () => {
      let i = 0;
      fallback = setInterval(() => {
        i += 1;
        setText(demo.slice(0, i));
        if (i >= demo.length) {
          clearInterval(fallback);
          setState("done");
        }
      }, 55);
    };

    if (Ctor) {
      const r = new Ctor();
      r.lang = navigator.language || "en-US";
      r.interimResults = true;
      r.onresult = (e) => setText(Array.from(e.results, (res) => res[0].transcript).join(" "));
      r.onend = () => setState("done");
      r.onerror = () => playDemo();
      recognition.current = r;
      try {
        r.start();
      } catch {
        playDemo();
      }
    } else {
      playDemo();
    }
    return () => {
      clearInterval(fallback);
      recognition.current?.stop();
      recognition.current = null;
    };
  }, [open]);

  function finish() {
    recognition.current?.stop();
    if (text.trim()) onResult(text.trim());
    onClose();
  }

  return (
    <dialog
      ref={ref}
      aria-label="Voice search"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none border-0 bg-canvas/80 p-0 text-ink backdrop-blur-2xl backdrop:bg-black/40"
    >
      <div className="pt-safe pb-safe flex h-full flex-col items-center px-6">
        <div className="flex w-full justify-end pt-2">
          <button type="button" onClick={onClose} aria-label="Cancel" className="glass grid size-12 place-items-center rounded-full">
            <Icon name="close" />
          </button>
        </div>
        <div className="flex flex-1 flex-col items-center justify-center gap-8 text-center">
          <div className="relative grid size-40 place-items-center">
            <span className="absolute inset-0 rounded-full bg-accent/25 motion-safe:animate-breathe" />
            <span className="absolute inset-5 rounded-full bg-accent/35 motion-safe:animate-breathe [animation-delay:0.3s]" />
            <span className="glass glass-prominent relative grid size-24 place-items-center rounded-full">
              <Icon name="mic" className="size-10" />
            </span>
          </div>
          <div aria-hidden="true" className="flex h-10 items-center gap-1.5">
            {Array.from({ length: 9 }, (_, i) => (
              <span
                key={i}
                className={`w-1.5 origin-center rounded-full bg-white ${state === "listening" ? "motion-safe:animate-wave" : "scale-y-[0.25]"}`}
                style={{ height: `${[18, 30, 40, 26, 38, 22, 34, 28, 16][i]}px`, animationDelay: `${i * 0.09}s` }}
              />
            ))}
          </div>
          <p aria-live="polite" className="min-h-[2.6em] max-w-sm font-display text-[26px] leading-tight font-bold tracking-[-0.02em] text-balance">
            {text || <span className="text-ink-3">Listening… try “wireless earbuds under $40”</span>}
          </p>
        </div>
        <button
          type="button"
          onClick={finish}
          disabled={!text.trim()}
          className="mb-4 h-[52px] w-full max-w-sm rounded-full bg-accent text-[15px] font-bold transition-opacity disabled:opacity-40"
        >
          {state === "done" ? `Search “${text.trim()}”` : "Done"}
        </button>
      </div>
    </dialog>
  );
}

