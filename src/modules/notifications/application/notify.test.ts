import { describe, expect, it } from "vitest";
import type { Notification } from "../domain/notification";
import { isPushEndpoint, type PushAlert, type PushDevice } from "../domain/push";
import type { NotificationRepository, PushDeviceRepository } from "../domain/repositories";
import { WebPushSender } from "../infrastructure/web-push";
import { makeNotifications, type PushSender } from "./notify";

const ENDPOINT = "https://fcm.googleapis.com/fcm/send/abc";
const device = { endpoint: ENDPOINT, p256dh: "p256dh-key", auth: "auth-key" };
const message = { kind: "order_paid", title: "Paid", body: "We have your order.", link: "/orders/1", email: true };

function setup(send: PushSender["send"] = async () => "sent") {
  const seen = new Set<string>();
  const stored: PushDevice[] = [];
  const pushed: [string, PushAlert][] = [];
  const emailed: string[] = [];
  const notifications = {
    add: async (n: Notification) => !seen.has(n.key) && !!seen.add(n.key),
  } as NotificationRepository;
  const devices: PushDeviceRepository = {
    save: async (d) => void stored.push(d),
    forAccount: async (accountId, limit) => stored.filter((d) => d.accountId === accountId).slice(0, limit),
    remove: async (accountId, endpoint) => void stored.splice(0, stored.length, ...stored.filter((d) => d.accountId !== accountId || d.endpoint !== endpoint)),
    removeAll: async (accountId) => void stored.splice(0, stored.length, ...stored.filter((d) => d.accountId !== accountId)),
  };
  const app = makeNotifications({
    notifications,
    devices,
    push: {
      send: async (d, alert) => {
        pushed.push([d.endpoint, alert]);
        return send(d, alert);
      },
    },
    email: { send: async (to) => void emailed.push(to) },
    directory: { emailOf: async () => "someone@example.com" },
    clock: { now: () => new Date("2026-11-01T09:00:00Z") },
    newId: () => "id",
    siteUrl: "https://example.com",
    appName: "Test",
  });
  return { app, stored, pushed, emailed };
}

describe("push alerts", () => {
  it("sends each device one alert per cause", async () => {
    const { app, pushed } = setup();
    await app.addDevice("a", device);
    await app.notify(["a"], message, "key-1");
    await app.notify(["a"], message, "key-1");
    expect(pushed).toEqual([[ENDPOINT, { title: "Paid", body: "We have your order.", link: "/orders/1" }]]);
  });

  it("forgets a device its browser dropped", async () => {
    const { app, stored } = setup(async () => "gone");
    await app.addDevice("a", device);
    await app.notify(["a"], message, "key-1");
    expect(stored).toEqual([]);
  });

  it("still emails when a push fails", async () => {
    const { app, stored, emailed } = setup(async () => {
      throw new Error("push service down");
    });
    await app.addDevice("a", device);
    expect(await app.notify(["a"], message, "key-1")).toMatchObject({ sent: 1, pushFailures: 1 });
    expect(emailed).toEqual(["someone@example.com"]);
    expect(stored).toHaveLength(1);
  });

  it("caps how many devices one account can make the server post to", async () => {
    const { app, pushed } = setup();
    for (let i = 0; i < 15; i++) await app.addDevice("a", { ...device, endpoint: `${ENDPOINT}${i}` });
    await app.notify(["a"], message, "key-1");
    expect(pushed).toHaveLength(10);
  });

  it("refuses an address that isn't a browser's push service", async () => {
    const { app, stored } = setup();
    expect(await app.addDevice("a", { ...device, endpoint: "https://169.254.169.254/latest/meta-data" })).toBe(false);
    expect(stored).toEqual([]);
  });
});

describe("isPushEndpoint", () => {
  it.each([ENDPOINT, "https://updates.push.services.mozilla.com/wpush/v2/abc", "https://web.push.apple.com/abc", "https://wns2-db5p.notify.windows.com/w/?token=abc"])("accepts %s", (url) => {
    expect(isPushEndpoint(url)).toBe(true);
  });

  it.each([
    "http://fcm.googleapis.com/fcm/send/abc",
    "https://localhost/x",
    "https://127.0.0.1/x",
    "https://fcm.googleapis.com.evil.example/x",
    "https://evil.example/fcm.googleapis.com/x",
    "https://evilnotify.windows.com/x",
    "https://fcm.googleapis.com:8443/x",
    "https://user:pass@fcm.googleapis.com/x",
    "not a url",
  ])("refuses %s", (url) => {
    expect(isPushEndpoint(url)).toBe(false);
  });
});

describe("WebPushSender", () => {
  const stored = { ...device, accountId: "a", createdAt: new Date() };
  const sender = (send: never) => new WebPushSender({ publicKey: "public", privateKey: "private", subject: "mailto:help@example.com", send });
  const failing = (statusCode: number) =>
    (async () => {
      throw Object.assign(new Error("push failed"), { statusCode });
    }) as never;

  it("reports a dropped subscription as gone", async () => {
    expect(await sender(failing(410)).send(stored, { title: "t", body: "b", link: null })).toBe("gone");
    expect(await sender(failing(404)).send(stored, { title: "t", body: "b", link: null })).toBe("gone");
  });

  it("treats anything else as a failure, keeping the device", async () => {
    await expect(sender(failing(503)).send(stored, { title: "t", body: "b", link: null })).rejects.toThrow("push failed");
  });
});
