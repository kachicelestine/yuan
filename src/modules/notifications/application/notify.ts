import type { Clock } from "@/shared/kernel";
import type { Message, Notification } from "../domain/notification";
import type { NotificationRepository } from "../domain/repositories";

/** Sends one email. Failures are logged by the caller and never block the in-app notice. */
export interface EmailSender {
  send(to: string, subject: string, text: string): Promise<void>;
}

/** Looks up where to email someone (identity owns addresses). */
export interface EmailDirectory {
  emailOf(accountId: string): Promise<string | null>;
}

export type NotificationsDeps = {
  notifications: NotificationRepository;
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

export function makeNotifications({ notifications, email, directory, clock, newId, siteUrl, appName }: NotificationsDeps) {
  return {
    /**
     * Notifies each person once per `key`. Email goes only with the first delivery, so an
     * event processed twice never emails twice.
     */
    async notify(accountIds: readonly string[], message: Message, key: string): Promise<{ sent: number; emailFailures: number }> {
      let sent = 0;
      let emailFailures = 0;
      for (const accountId of new Set(accountIds)) {
        const fresh = await notifications.add({ id: newId(), accountId, kind: message.kind, title: message.title, body: message.body, link: message.link, key, createdAt: clock.now(), readAt: null });
        if (!fresh) continue;
        sent++;
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
      return { sent, emailFailures };
    },

    async list(accountId: string, limit = 50): Promise<NotificationView[]> {
      return (await notifications.listFor(accountId, limit)).map(toView);
    },

    unread: (accountId: string) => notifications.unread(accountId),

    markAllRead: (accountId: string) => notifications.markAllRead(accountId, clock.now()),
  };
}

export type Notifications = ReturnType<typeof makeNotifications>;
