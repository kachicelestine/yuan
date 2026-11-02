import { TEST_ADDRESS } from "./test-address";
import { beforeAll, describe, expect, it } from "vitest";
import { DrizzleInvoiceRepository } from "@/modules/payments/infrastructure/drizzle-payments-repositories";
import { SimulatedNetwork } from "@/modules/payments/infrastructure/networks";
import { openDatabase, type Database } from "@/shared/infrastructure/database";
import { newId } from "@/shared/kernel";
import { wire } from "./container";
import { seedAll } from "./seed";

describe("rewards: missions, badges and levels from real activity", () => {
  let db: Database;
  let network: SimulatedNetwork;
  const now = new Date("2026-10-24T10:00:00Z");
  const app = () => wire(db, { clock: { now: () => now }, payments: { network, simulator: network } });
  const buyer = newId();

  beforeAll(async () => {
    db = await openDatabase({ kind: "memory" });
    await seedAll(db);
    network = new SimulatedNetwork(db);
  });

  it("shows a newcomer every mission at zero and no badges", async () => {
    const v = await app().rewards.view(buyer);
    expect(v.missions.every((m) => m.progress === 0 && !m.claimed)).toBe(true);
    expect(v.badges.some((b) => b.earned)).toBe(false);
    expect(v.level).toMatchObject({ name: "Bronze", next: { name: "Silver", from: 1000 } });
    expect((await app().rewards.claim(buyer, "first-order")).ok).toBe(false);
  });

  it("pays a finished mission once and counts it toward the level", async () => {
    const r = await app().checkout({ buyerId: buyer, lines: [{ slug: "solar-panel-450w-bifacial", option: null, qty: 1 }], country: "NG", delivery: "cheapest", combineParcels: true, payDutiesNow: true, couponId: null, rail: "usdc-base", address: TEST_ADDRESS });
    if (!r.ok) throw new Error(r.error.message);
    await network.send((await new DrizzleInvoiceRepository(db).findById(r.value.invoiceId))!, now);
    await app().checkInvoice(r.value.invoiceId);

    const v = await app().rewards.view(buyer);
    expect(v.missions.find((m) => m.id === "first-order")).toMatchObject({ progress: 1, claimed: false });
    // Solar gear bought: that badge is earned.
    expect(v.badges.find((b) => b.id === "solar")?.earned).toBe(true);

    const claimed = await app().rewards.claim(buyer, "first-order");
    expect(claimed.ok && claimed.value.coins).toBe(100);
    expect(claimed.ok && claimed.value.view.missions.find((m) => m.id === "first-order")?.claimed).toBe(true);
    const twice = await app().rewards.claim(buyer, "first-order");
    expect(!twice.ok && twice.error.code).toBe("claimed");
    expect((await app().rewards.view(buyer)).earned).toBe(100);
    expect((await app().engagement.snapshot(buyer)).coinsEarned).toBe(100);
  });
});
