import type { Clock } from "@/shared/kernel";
import type { Message, Notification } from "../domain/notification";
import { isPushEndpoint, type PushAlert, type PushDevice } from "../domain/push";
import type { NotificationRepository, PushDeviceRepository } from "../domain/repositories";

/** The most browsers one person's alerts go to, newest first. */
const MAX_DEVICES = 10;
const MAX_ALERT_BODY = 240;

/** Sends one email. Failures are logged by the caller and never block the in-app notice. */
export interface EmailSender {
  send(to: string, subject: string, text: string): Promise<void>;
}

/** Looks up where to email someone (identity owns addresses). */
export interface EmailDirectory {
  emailOf(accountId: string): Promise<string | null>;
}

/** Sends one alert to one browser; "gone" means that browser dropped the subscription. */
export interface PushSender {
  send(device: PushDevice, alert: PushAlert): Promise<"sent" | "gone">;
}

export type NotificationsDeps = {
  notifications: NotificationRepository;
  devices: PushDeviceRepository;
  /** Null when this site has no push keys. */
  push: PushSender | null;
  email: EmailSender;
  directory: EmailDirectory;
  clock: Clock;
  newId: () => string;
  /** Absolute links in emails. */
  siteUrl: string;
  appName: string;
};

export type NotificationView = { id: string; kind: string; title: string; body: string; link: string | null; at: string; read: boolean };

const toView = (n: Notification): NotificationView => ({ id: n.id, kind: n.kind, title: n.title, body: n.body, link: n.link, at: n.createdAt.toISOString(), read: n.readAt !== null });

export function makeNotifications({ notifications, devices, push, email, directory, clock, newId, siteUrl, appName }: NotificationsDeps) {
  /** Alerts someone's browsers; returns how many failed. A missed alert is still in the app. */
  async function alert(accountId: string, message: Message) {
    if (!push) return 0;
    let failures = 0;
    for (const device of await devices.forAccount(accountId, MAX_DEVICES)) {
      try {
        const result = await push.send(device, { title: message.title, body: message.body.slice(0, MAX_ALERT_BODY), link: message.link });
        if (result === "gone") await devices.remove(accountId, device.endpoint);
      } catch {
        failures++;
      }
    }
    return failures;
  }

  return {
    /**
     * Notifies each person once per `key`. Alerts and email go only with the first delivery,
     * so an event processed twice never sends them twice.
     */
    async notify(accountIds: readonly string[], message: Message, key: string): Promise<{ sent: number; emailFailures: number; pushFailures: number }> {
      let sent = 0;
      let emailFailures = 0;
      let pushFailures = 0;
      for (const accountId of new Set(accountIds)) {
        const fresh = await notifications.add({ id: newId(), accountId, kind: message.kind, title: message.title, body: message.body, link: message.link, key, createdAt: clock.now(), readAt: null });
        if (!fresh) continue;
        sent++;
        pushFailures += await alert(accountId, message);
        if (!message.email) continue;
        const to = await directory.emailOf(accountId);
        if (!to) continue;
        const link = message.link ? `\n\n${siteUrl.replace(/\/$/, "")}${message.link}` : "";
        try {
          await email.send(to, message.title, `${message.body}${link}\n\n— ${appName}`);
        } catch {
          emailFailures++;
        }
      }
      return { sent, emailFailures, pushFailures };
    },

    /** Turns alerts on for a browser, for whoever is signed in on it; false if the address isn't a push service's. */
    async addDevice(accountId: string, device: { endpoint: string; p256dh: string; auth: string }) {
      if (!isPushEndpoint(device.endpoint)) return false;
      await devices.save({ ...device, accountId, createdAt: clock.now() });
      return true;
    },

    removeDevice: (accountId: string, endpoint: string) => devices.remove(accountId, endpoint),

    /** Their account closed: no more alerts to any browser. */
    forgetDevices: (accountId: string) => devices.removeAll(accountId),

    async list(accountId: string, limit = 50): Promise<NotificationView[]> {
      return (await notifications.listFor(accountId, limit)).map(toView);
    },

    unread: (accountId: string) => notifications.unread(accountId),

    markAllRead: (accountId: string) => notifications.markAllRead(accountId, clock.now()),
  };
}

export type Notifications = ReturnType<typeof makeNotifications>;
