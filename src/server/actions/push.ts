"use server";

import { z } from "zod";
import { services } from "../container";
import { allow } from "../rate-limits";
import { currentAccount } from "../session";

const endpoint = z.string().min(1).max(2048);
const key = (max: number) => z.string().regex(/^[A-Za-z0-9_-]+=*$/).min(8).max(max);
const Device = z.object({ endpoint, p256dh: key(200), auth: key(100) });

/** Turns alerts on for this browser, for whoever is signed in on it. */
export async function savePushDeviceAction(input: z.input<typeof Device>): Promise<boolean> {
  const account = await currentAccount();
  const p = Device.safeParse(input);
  if (!account || !p.success || !(await allow("account.write", account.id))) return false;
  return (await services()).notifications.addDevice(account.id, p.data);
}

/** Turns alerts off for this browser. */
export async function removePushDeviceAction(address: string): Promise<void> {
  const account = await currentAccount();
  const p = endpoint.safeParse(address);
  if (account && p.success) await (await services()).notifications.removeDevice(account.id, p.data);
}
