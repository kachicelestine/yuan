import type { PushSender } from "../application/notify";
import type { PushAlert, PushDevice } from "../domain/push";

/** How long a browser's push service keeps an alert for a device that's offline. */
const TTL_SECONDS = 24 * 60 * 60;
const TIMEOUT_MS = 5_000;

type Send = (typeof import("web-push"))["sendNotification"];

/** Encrypted alerts through each browser's push service, signed with this site's VAPID keys. */
export class WebPushSender implements PushSender {
  constructor(private readonly opts: { publicKey: string; privateKey: string; subject: string; send?: Send }) {}

  async send(device: PushDevice, alert: PushAlert) {
    // Loaded on the first alert, so pages that never send one don't pay for it at start-up.
    const send = this.opts.send ?? (await import("web-push")).sendNotification;
    try {
      await send({ endpoint: device.endpoint, keys: { p256dh: device.p256dh, auth: device.auth } }, JSON.stringify(alert), {
        TTL: TTL_SECONDS,
        timeout: TIMEOUT_MS,
        vapidDetails: { subject: this.opts.subject, publicKey: this.opts.publicKey, privateKey: this.opts.privateKey },
      });
      return "sent" as const;
    } catch (error) {
      // 404 and 410 mean the browser dropped the subscription for good.
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) return "gone" as const;
      throw error;
    }
  }
}
