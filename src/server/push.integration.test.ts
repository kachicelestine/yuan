import { beforeAll, describe, expect, it } from "vitest";
import type { PushAlert, PushDevice } from "@/modules/notifications";
import { SimulatedNetwork } from "@/modules/payments/infrastructure/networks";
import { openDatabase, type Database } from "@/shared/infrastructure/database";
import { newId } from "@/shared/kernel";
import { closeAccount } from "./account-closure";
import { wire } from "./container";

// Alerts on a device follow whoever signed in on it last, and end with the account.
describe("push devices", () => {
  let db: Database;
  const sent: [PushDevice, PushAlert][] = [];
  const app = () => wire(db, { payments: { network: new SimulatedNetwork(db), simulator: null }, push: { send: async (d, a) => (sent.push([d, a]), "sent") } });
  const device = { endpoint: "https://fcm.googleapis.com/fcm/send/phone", p256dh: "p256dh-key", auth: "auth-key" };
  const message = { kind: "reminder", title: "Starting soon", body: "Tap to get there first.", link: "/live", email: false };
  const [first, second] = [newId(), newId()];

  beforeAll(async () => {
    db = await openDatabase({ kind: "memory" });
  });

  it("alerts the account the device belongs to, and moves it when someone else signs in", async () => {
    expect(await app().notifications.addDevice(first, device)).toBe(true);
    await app().notifications.notify([first], message, "one");
    expect(sent.map(([d]) => d.accountId)).toEqual([first]);

    await app().notifications.addDevice(second, device);
    await app().notifications.notify([first], message, "two");
    expect(sent).toHaveLength(1);
    await app().notifications.notify([second], message, "three");
    expect(sent.map(([d]) => d.accountId)).toEqual([first, second]);
  });

  it("lets only its own account turn a device off", async () => {
    await app().notifications.removeDevice(first, device.endpoint);
    await app().notifications.notify([second], message, "four");
    expect(sent).toHaveLength(3);
    await app().notifications.removeDevice(second, device.endpoint);
    await app().notifications.notify([second], message, "five");
    expect(sent).toHaveLength(3);
  });

  it("forgets every device when the account closes", async () => {
    await app().notifications.addDevice(second, device);
    await closeAccount(app(), second);
    await app().notifications.notify([second], message, "six");
    expect(sent).toHaveLength(3);
  });
});
