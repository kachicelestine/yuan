import { beforeAll, describe, expect, it } from "vitest";
import { SimulatedNetwork } from "@/modules/payments/infrastructure/networks";
import { openDatabase, type Database } from "@/shared/infrastructure/database";
import { OutboxDispatcher } from "@/shared/infrastructure/outbox";
import { newId } from "@/shared/kernel";
import { wire } from "./container";
import { eventHandlers } from "./jobs/jobs";
import { seedAll } from "./seed";

describe("free samples for creators", () => {
  let db: Database;
  let now = new Date("2026-10-24T10:00:00Z");
  const app = () => wire(db, { clock: { now: () => now }, payments: { network: new SimulatedNetwork(db), simulator: null } });
  const drain = async () => {
    const d = new OutboxDispatcher(db, eventHandlers(app()), { now: () => now, maxAttempts: 1 });
    for (let i = 0; i < 10; i++) if ((await d.dispatchOnce()).claimed === 0) break;
  };
  const address = { name: "Ada Obi", line1: "12 Marina Road", line2: "", city: "Lagos", region: "", postcode: "", country: "ng" };

  beforeAll(async () => {
    db = await openDatabase({ kind: "memory" });
    await seedAll(db, now);
  });

  it("goes from request to shipped to posted when the creator's video goes live", async () => {
    const [offer] = await app().samples.offers();
    expect(offer).toBeDefined();
    const creator = { accountId: newId(), name: "shopper-cr8tor" };

    expect((await app().samples.request(creator, offer.id, { ...address, line1: "" }, "")).ok).toBe(false);
    const asked = await app().samples.request(creator, offer.id, address, "I review gadgets for 40k people");
    if (!asked.ok) throw new Error(asked.error.message);
    expect(asked.value.address).toBeUndefined(); // the creator's own view doesn't echo it
    expect((await app().samples.offers()).find((o) => o.id === offer.id)!.remaining).toBe(offer.remaining - 1);
    const again = await app().samples.request(creator, offer.id, address, "");
    expect(!again.ok && again.error.code).toBe("not_allowed");

    // The shop sees the address and ships it.
    const inbox = await app().samples.sellerRequests(offer.sellerId);
    expect(inbox.find((r) => r.id === asked.value.id)?.address?.country).toBe("NG");
    expect((await app().samples.ship("someone-else", asked.value.id, { carrier: "DHL", tracking: "JD014600003" })).ok).toBe(false);
    expect((await app().samples.ship(offer.sellerId, asked.value.id, { carrier: "DHL", tracking: "bad" })).ok).toBe(false);
    const shipped = await app().samples.ship(offer.sellerId, asked.value.id, { carrier: "DHL", tracking: "jd014600003" });
    expect(shipped.ok && shipped.value).toMatchObject({ status: "shipped", tracking: "JD014600003" });
    await drain();
    expect((await app().notifications.list(creator.accountId)).some((n) => n.kind === "sample")).toBe(true);

    // A video by the creator featuring the product closes the deal.
    expect(await app().samples.videoPosted({ authorId: creator.accountId, productSlug: offer.slug, videoId: "v-1" })).toBe(1);
    expect((await app().samples.mine(creator.accountId))[0].status).toBe("posted");
  });

  it("gives the sample back when declined, and lapses ones nobody posts about", async () => {
    const [a, b] = await app().samples.offers();
    const creator = { accountId: newId(), name: "shopper-late00" };
    const r1 = await app().samples.request(creator, a.id, address, "");
    const r2 = await app().samples.request(creator, b.id, address, "");
    if (!r1.ok || !r2.ok) throw new Error("request");
    const before = (await app().samples.offers()).find((o) => o.id === a.id)!.remaining;
    expect((await app().samples.decline(a.sellerId, r1.value.id, "no")).ok).toBe(false);
    expect((await app().samples.decline(a.sellerId, r1.value.id, "Out of this colour, sorry")).ok).toBe(true);
    expect((await app().samples.offers()).find((o) => o.id === a.id)!.remaining).toBe(before + 1);

    await app().samples.ship(b.sellerId, r2.value.id, { carrier: "EMS", tracking: "EE123456789CN" });
    now = new Date(now.getTime() + 22 * 86_400_000);
    expect(await app().samples.lapse()).toBe(1);
    expect((await app().samples.mine(creator.accountId)).map((r) => r.status).sort()).toEqual(["declined", "lapsed"]);
  });
});
