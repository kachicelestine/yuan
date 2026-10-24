import type { Notification } from "./notification";

export interface NotificationRepository {
  /** False when this person already has a notification with the same key. */
  add(n: Notification): Promise<boolean>;
  listFor(accountId: string, limit: number): Promise<Notification[]>;
  unread(accountId: string): Promise<number>;
  markAllRead(accountId: string, at: Date): Promise<void>;
}
