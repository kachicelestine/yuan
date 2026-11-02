import { removePushDeviceAction } from "@/server/actions/push";

/** This browser's push subscription, if alerts are on. */
export const currentPushDevice = async () => (await (await navigator.serviceWorker?.getRegistration())?.pushManager?.getSubscription()) ?? null;

/** Stops alerts reaching this browser, so whoever signs in next doesn't get them. */
export async function dropPushDevice() {
  try {
    const device = await currentPushDevice();
    if (!device) return;
    await removePushDeviceAction(device.endpoint);
    await device.unsubscribe();
  } catch {
    // No push support, or offline: signing out still goes ahead.
  }
}
