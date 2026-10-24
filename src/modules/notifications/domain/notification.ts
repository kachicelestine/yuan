/** Something someone should know about, shown in their notifications and sometimes emailed. */
export type Notification = Readonly<{
  id: string;
  accountId: string;
  /** What happened, e.g. "order_paid"; lets the UI pick an icon and people mute kinds later. */
  kind: string;
  title: string;
  body: string;
  /** Where tapping it goes. */
  link: string | null;
  /** Unique per person per cause, so an event delivered twice notifies once. */
  key: string;
  createdAt: Date;
  readAt: Date | null;
}>;

export type Message = Readonly<{ kind: string; title: string; body: string; link: string | null; email: boolean }>;
