"use client";

import { useEffect, useState, useTransition } from "react";
import { Icon } from "@/components/icon";
import { publicEnv } from "@/config/public-env";
import { currentPushDevice, dropPushDevice } from "@/lib/push";
import { savePushDeviceAction } from "@/server/actions/push";

type State = "hidden" | "off" | "on" | "blocked" | "install";

/** A browser that can't reach its push service can wait forever. */
const SUBSCRIBE_TIMEOUT_MS = 45_000;

const NOTES: Record<Exclude<State, "hidden">, string> = {
  off: "Orders, price drops and live shows, even with the app closed.",
  on: "Alerts reach this device, even with the app closed.",
  blocked: "Alerts are blocked. Allow them for this site in your browser's settings.",
  install: "On iPhone, add this site to your Home Screen, then turn alerts on from there.",
};

/** A browser hands out its keys as bytes or base64url; the server stores base64url. */
function details(device: PushSubscription) {
  const { keys } = device.toJSON();
  return { endpoint: device.endpoint, p256dh: keys?.p256dh ?? "", auth: keys?.auth ?? "" };
}

const toBytes = (base64url: string) => Uint8Array.from(atob(base64url.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));

/** The switch for alerts on this device. Shows nothing where alerts can't work. */
export function PushToggle() {
  const [state, setState] = useState<State>("hidden");
  const [error, setError] = useState(false);
  const [busy, start] = useTransition();
  const key = publicEnv.vapidPublicKey;

  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !key) return;
    (async () => {
      if (!("PushManager" in window) || !("serviceWorker" in navigator)) {
        if (/iP(hone|ad|od)/.test(navigator.userAgent)) setState("install");
        return;
      }
      if (Notification.permission === "denied") return setState("blocked");
      const device = await currentPushDevice();
      // Whoever is signed in now gets this browser's alerts, and a lost record comes back.
      if (device) await savePushDeviceAction(details(device));
      setState(device ? "on" : "off");
    })().catch(() => {});
  }, [key]);

  const turnOn = async () => {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return setState(permission === "denied" ? "blocked" : "off");
    const worker = await navigator.serviceWorker.ready;
    const timedOut = new Promise<never>((_, reject) => setTimeout(() => reject(new Error("timed out")), SUBSCRIBE_TIMEOUT_MS));
    const device = await Promise.race([worker.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toBytes(key ?? "") }), timedOut]);
    if (await savePushDeviceAction(details(device))) return setState("on");
    await device.unsubscribe();
    setError(true);
  };

  const toggle = () =>
    start(async () => {
      setError(false);
      try {
        if (state === "on") {
          await dropPushDevice();
          setState("off");
        } else {
          await turnOn();
        }
      } catch {
        setError(true);
      }
    });

  if (state === "hidden") return null;
  const on = state === "on";
  return (
    <section aria-label="Alerts" className="glass mb-3 flex items-center gap-3 rounded-[22px] p-4">
      <Icon name="bell" className="size-5 shrink-0 text-ink-2" />
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold">Alerts on this device</span>
        <span role={error ? "alert" : undefined} className="block text-xs text-ink-2">
          {error ? "That didn't work. Try again in a moment." : busy ? "One moment…" : NOTES[state]}
        </span>
      </span>
      {(on || state === "off") && (
        <button type="button" role="switch" aria-checked={on} aria-label="Alerts on this device" disabled={busy} onClick={toggle} className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${on ? "bg-positive" : "bg-white/20"}`}>
          <span className={`absolute top-1 size-5 rounded-full bg-white transition-[left] ${on ? "left-6" : "left-1"}`} />
        </button>
      )}
    </section>
  );
}
