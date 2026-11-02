import type { Notification } from "./notification";
import type { PushDevice } from "./push";

export interface NotificationRepository {
  /** False when this person already has a notification with the same key. */
  add(n: Notification): Promise<boolean>;
  listFor(accountId: string, limit: number): Promise<Notification[]>;
  unread(accountId: string): Promise<number>;
  markAllRead(accountId: string, at: Date): Promise<void>;
}

export interface PushDeviceRepository {
  /** Adds a browser, or moves it to whoever signed in on it last. */
  save(device: PushDevice): Promise<void>;
  /** Someone's browsers, newest first. */
  forAccount(accountId: string, limit: number): Promise<PushDevice[]>;
  remove(accountId: string, endpoint: string): Promise<void>;
  removeAll(accountId: string): Promise<void>;
}
