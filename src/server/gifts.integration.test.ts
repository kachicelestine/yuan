import { beforeAll, describe, expect, it } from "vitest";
import type { CheckoutRequest, GiftInput } from "@/modules/ordering";
import { DrizzleInvoiceRepository } from "@/modules/payments/infrastructure/drizzle-payments-repositories";
import { SimulatedNetwork } from "@/modules/payments/infrastructure/networks";
import { OutboxDispatcher } from "@/shared/infrastructure/outbox";
import { openDatabase, type Database } from "@/shared/infrastructure/database";
import { newId } from "@/shared/kernel";
import { wire } from "./container";
import { eventHandlers } from "./jobs/jobs";
import { seedAll } from "./seed";
import { TEST_ADDRESS } from "./test-address";

// A gift is paid by one person and delivered to another, who adds the address (and their
// size, if allowed) through a private link; the shop can't ship until then.
describe("gifts", () => {
  let db: Database;
  let network: SimulatedNetwork;
  const now = new Date("2026-10-24T10:00:00Z");
  const app = () => wire(db, { clock: { now: () => now }, payments: { network, simulator: network } });
  const sender = newId();
  const card: GiftInput = { fromName: "Mei", recipientName: "Ada", theme: "thanks", message: "For all the late-night calls.", hidePrice: true, chooseOption: "Size" };
  const order = (patch: Partial<CheckoutRequest> = {}): CheckoutRequest => ({
    buyerId: sender,
    lines: [{ slug: "hoodie-heavyweight", option: null, qty: 1 }],
    country: "NG",
    address: null,
    gift: card,
    shippingMethod: "standard",
    combineParcels: true,
    payDutiesNow: true,
    couponId: null,
    rail: "usdc-base",
    ...patch,
  });
  const pay = async (invoiceId: string) => {
    await network.send((await new DrizzleInvoiceRepository(db).findById(invoiceId))!, now);
    await app().checkInvoice(invoiceId);
  };
  const drain = async () => {
    const d = new OutboxDispatcher(db, eventHandlers(app()), { now: () => now, maxAttempts: 1 });
    for (let i = 0; i < 10; i++) if ((await d.dispatchOnce()).claimed === 0) break;
  };
  const tokenOf = async (orderId: string) => (await app().gifts.forSender(sender, orderId))!.token;

  beforeAll(async () => {
    db = await openDatabase({ kind: "memory" });
    await seedAll(db, now);
    network = new SimulatedNetwork(db);
  });

  it("takes no address for a gift, and needs one for anything else", async () => {
    const withAddress = await app().checkout(order({ address: TEST_ADDRESS }));
    expect(!withAddress.ok && withAddress.error.code).toBe("invalid_gift");
    const plain = await app().checkout(order({ gift: undefined }));
    expect(!plain.ok && plain.error.code).toBe("invalid_address");
    const noName = await app().checkout(order({ gift: { ...card, recipientName: " " } }));
    expect(!noName.ok && noName.error.code).toBe("invalid_gift");
  });

  it("waits for the recipient's address and size, then the shop ships it", async () => {
    const placed = await app().checkout(order());
    if (!placed.ok) throw new Error(placed.error.message);
    const { orderId } = placed.value;
    const token = await tokenOf(orderId);
    expect(token).toMatch(/^[A-Za-z0-9_-]{24}$/);

    const view = await app().gifts.view(token);
    expect(view).toMatchObject({ fromName: "Mei", recipientName: "Ada", price: null, chooseOption: "Size", option: null, state: "unpaid", country: "NG" });
    const early = await app().gifts.claim(token, TEST_ADDRESS, "L", ["S", "M", "L"]);
    expect(!early.ok && early.error.code).toBe("gift_unpaid");

    await pay(placed.value.invoiceId);
    await drain();
    expect((await app().gifts.view(token))?.state).toBe("waiting");
    const sellerId = (await app().catalog.getProductsBySlugs(["hoodie-heavyweight"]))[0].sellerId;
    const waiting = (await app().sellerOrders.list(sellerId)).find((o) => o.id === orderId)!;
    expect(waiting.gift).toMatchObject({ recipientName: "Ada", message: "For all the late-night calls.", chooseOption: "Size", choice: null, waiting: true });
    expect(waiting.gift).not.toHaveProperty("token");
    expect(waiting.address).toBeNull();
    const tooSoon = await app().fulfilment.ship(sellerId, orderId, { carrier: "DHL", tracking: "DHL123456789" });
    expect(!tooSoon.ok && tooSoon.error.code).toBe("not_shippable");

    const noSize = await app().gifts.claim(token, TEST_ADDRESS, null, ["S", "M", "L"]);
    expect(!noSize.ok && noSize.error.code).toBe("invalid_choice");
    const claimed = await app().gifts.claim(token, { ...TEST_ADDRESS, name: "Ada Obi" }, "L", ["S", "M", "L"]);
    expect(claimed.ok && claimed.value).toMatchObject({ state: "on_its_way", choice: "L" });
    const again = await app().gifts.claim(token, TEST_ADDRESS, "M", ["S", "M", "L"]);
    expect(!again.ok && again.error.code).toBe("gift_claimed");

    await drain();
    expect((await app().notifications.list(sender)).map((n) => n.title)).toContain("Ada opened your gift");
    const ready = (await app().sellerOrders.list(sellerId)).find((o) => o.id === orderId)!;
    expect(ready.address?.name).toBe("Ada Obi");
    expect(ready.gift).toMatchObject({ choice: "L", waiting: false });
    expect((await app().fulfilment.ship(sellerId, orderId, { carrier: "DHL", tracking: "DHL123456789" })).ok).toBe(true);

    expect((await app().gifts.thank(token, "🙏")).ok).toBe(true);
    expect((await app().gifts.thank(token, "💩")).ok).toBe(false);
  });

  it("lets the sender add the address themselves", async () => {
    const placed = await app().checkout(order({ gift: { ...card, chooseOption: null, hidePrice: false } }));
    if (!placed.ok) throw new Error(placed.error.message);
    await pay(placed.value.invoiceId);
    expect((await app().gifts.view(await tokenOf(placed.value.orderId)))?.price).toBeGreaterThan(0);
    expect((await app().gifts.senderAddress(newId(), placed.value.orderId, TEST_ADDRESS)).ok).toBe(false); // not theirs
    const r = await app().gifts.senderAddress(sender, placed.value.orderId, TEST_ADDRESS);
    expect(r.ok && r.value).toMatchObject({ claimed: true, claimedBy: "sender" });
  });
});
