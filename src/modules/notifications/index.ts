// Public surface of the notifications context: in-app notices and the emails and alerts that go with them.
export { makeNotifications, type EmailDirectory, type EmailSender, type Notifications, type NotificationsDeps, type NotificationView, type PushSender } from "./application/notify";
export type { Message, Notification } from "./domain/notification";
export type { PushAlert, PushDevice } from "./domain/push";
export type { NotificationRepository, PushDeviceRepository } from "./domain/repositories";
