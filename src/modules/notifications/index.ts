// Public surface of the notifications context: in-app notices and the emails that go with them.
export { makeNotifications, type EmailDirectory, type EmailSender, type Notifications, type NotificationsDeps, type NotificationView } from "./application/notify";
export type { Message, Notification } from "./domain/notification";
export type { NotificationRepository } from "./domain/repositories";
