"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/icon";
import { brand } from "@/config/brand";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

/** "Add to home screen": a one-tap install on Chrome and Edge, and the two steps on iPhone. Hidden once installed. */
export function InstallCard() {
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [steps, setSteps] = useState(false);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    const standalone = window.matchMedia("(display-mode: standalone)");
    const sync = () => setInstalled(standalone.matches);
    sync();
    standalone.addEventListener("change", sync);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
      standalone.removeEventListener("change", sync);
    };
  }, []);

  if (installed) return null;

  async function install() {
    if (!prompt) return setSteps(!steps);
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") setInstalled(true);
    setPrompt(null);
  }

  return (
    <section aria-label="Install the app" className="glass overflow-hidden rounded-[26px]">
      <div className="flex items-center gap-3 p-3.5">
        <span className="grid size-12 shrink-0 place-items-center rounded-[14px] bg-[radial-gradient(circle_at_30%_20%,#ff7a52,#cc3a17_55%,#7a1f0b)] font-display text-xl font-extrabold">{brand.name[0]}</span>
        <span className="min-w-0 flex-1">
          <b className="block text-sm font-semibold">Put {brand.name} on your home screen</b>
          <span className="block text-xs text-ink-2">Opens full screen, keeps working offline, no app store.</span>
        </span>
        <button type="button" aria-expanded={prompt ? undefined : steps} onClick={install} className="h-10 shrink-0 rounded-full bg-white px-4 text-[13px] font-bold text-black">
          {prompt ? "Install" : "How"}
        </button>
      </div>
      {steps && !prompt && (
        <ol className="flex flex-col gap-2 border-t border-line px-4 py-3 text-[13px] text-ink-2">
          <li className="flex items-center gap-2.5">
            <span className="grid size-6 place-items-center rounded-full bg-white/10 text-xs font-bold text-ink">1</span>
            Tap <Icon name="share" className="size-4 text-ink" /> Share in your browser&apos;s toolbar
          </li>
          <li className="flex items-center gap-2.5">
            <span className="grid size-6 place-items-center rounded-full bg-white/10 text-xs font-bold text-ink">2</span>
            Choose <b className="font-semibold text-ink">Add to Home Screen</b>
          </li>
        </ol>
      )}
    </section>
  );
}
