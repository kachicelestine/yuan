import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { CopyEncoder } from "@/modules/content/infrastructure/copy-encoder";
import type { BusinessDetails } from "@/modules/merchants";
import { SimulatedNetwork } from "@/modules/payments/infrastructure/networks";
import { openDatabase, type Database } from "@/shared/infrastructure/database";
import { outbox } from "@/shared/infrastructure/platform-schema";
import { LocalStorage } from "@/shared/infrastructure/storage/local-storage";
import { fixedClock, money, newId } from "@/shared/kernel";
import { wire } from "./container";
import { seedAll } from "./seed";

describe("selling on the platform", () => {
  let db: Database;
  let dir: string;
  let publicStorage: LocalStorage;
  let privateStorage: LocalStorage;
  const clock = fixedClock("2026-10-24T15:00:00Z");
  const app = () =>
    wire(db, {
      clock,
      payments: { network: new SimulatedNetwork(db), simulator: null },
      media: { storage: publicStorage, privateStorage, encoder: new CopyEncoder(publicStorage), premoderated: false },
    });

  const business = (handle: string): BusinessDetails => ({
    name: "Kente Looms",
    handle,
    kind: "Maker",
    country: "gh",
    city: "Bonwire",
    address: "12 Weavers Lane, Bonwire, Ashanti",
    phone: "+233 24 000 0000",
    website: null,
    yearsInBusiness: 9,
    description: "Hand-woven kente from a family workshop of twelve weavers.",
  });
  const wallet = "0x1111111111111111111111111111111111111111";

  /** What the browser does with a ticket. */
  async function put(storage: LocalStorage, url: string, bytes: Uint8Array<ArrayBuffer>) {
    const ticket = storage.verify(new URL(url, "http://x").searchParams);
    if (!ticket) throw new Error("ticket didn't verify");
    await storage.receive(ticket, new Blob([bytes]).stream());
  }

  async function uploadDocument(accountId: string, kind: "business_license" | "id_front") {
    const t = await app().onboarding.startDocument(accountId, { kind, contentType: "image/jpeg", bytes: 64 });
    if (!t.ok) throw new Error(t.error.message);
    await put(privateStorage, t.value.url, new Uint8Array(64).fill(1));
    const r = await app().onboarding.attachDocument(accountId, { kind, key: t.value.key });
    if (!r.ok) throw new Error(r.error.message);
    return t.value.key;
  }

  /** An approved shop owned by a new account. */
  async function openShop(handle: string) {
    const owner = newId();
    expect((await app().onboarding.saveDetails(owner, business(handle), wallet)).ok).toBe(true);
    await uploadDocument(owner, "business_license");
    await uploadDocument(owner, "id_front");
    const submitted = await app().onboarding.submit(owner);
    if (!submitted.ok) throw new Error(submitted.error.message);
    const approved = await app().onboarding.approve(newId(), submitted.value.id);
    if (!approved.ok) throw new Error(approved.error.message);
    return owner;
  }

  beforeAll(async () => {
    db = await openDatabase({ kind: "memory" });
    await seedAll(db);
    dir = await mkdtemp(join(tmpdir(), "lychee-sellers-"));
    publicStorage = new LocalStorage({ dir: join(dir, "media"), baseUrl: "/media", secret: "test-secret-test-secret-test-secret", now: () => clock.now() });
    privateStorage = new LocalStorage({ dir: join(dir, "private"), baseUrl: "", secret: "test-secret-test-secret-test-secret", now: () => clock.now(), uploadPath: "/api/storage/upload" });
  });
  afterAll(() => rm(dir, { recursive: true, force: true }));

  it("needs details, a payout wallet and documents before an application can be submitted", async () => {
    const me = newId();
    expect((await app().onboarding.submit(me)).ok).toBe(false);
    const bad = await app().onboarding.saveDetails(me, { ...business("ok-handle"), handle: "admin" }, wallet);
    expect(bad.ok || bad.error.code).toBe("invalid_details");
    expect((await app().onboarding.saveDetails(me, business("kente-one"), "not-a-wallet")).ok).toBe(false);
    expect((await app().onboarding.saveDetails(me, business("kente-one"), wallet)).ok).toBe(true);
    const early = await app().onboarding.submit(me);
    expect(early.ok || early.error.code).toBe("missing_documents");
    // Someone else can't claim the same shop address, nor an existing shop's.
    const rival = await app().onboarding.saveDetails(newId(), business("kente-one"), wallet);
    expect(rival.ok || rival.error.code).toBe("handle_taken");
    const squat = await app().onboarding.saveDetails(newId(), business("sunvolt"), wallet);
    expect(squat.ok || squat.error.code).toBe("handle_taken");
  });

  it("keeps documents private: reviewers get expiring links, the public route never serves them", async () => {
    const me = newId();
    await app().onboarding.saveDetails(me, business("kente-two"), wallet);
    const key = await uploadDocument(me, "business_license");
    expect(key.startsWith(`kyc/${me}/`)).toBe(true);
    // Another person can't attach my upload to their application.
    expect((await app().onboarding.attachDocument(newId(), { kind: "id_front", key })).ok).toBe(false);
    expect(await publicStorage.head(key)).toBeNull();
    expect(await privateStorage.head(key)).not.toBeNull();
    await uploadDocument(me, "id_front");
    const submitted = await app().onboarding.submit(me);
    if (!submitted.ok) throw new Error(submitted.error.message);
    const review = await app().onboarding.review(submitted.value.id);
    expect(review?.documents).toHaveLength(2);
    const link = new URL(review!.documents[0].url, "http://x");
    expect(privateStorage.verifyDownload(link.searchParams)).toMatch(/^kyc\//);
    // A public-media ticket signed for the same key is a different signature entirely.
    expect(publicStorage.verifyDownload(link.searchParams)).toBeNull();
  });

  it("approval opens a verified shop owned by the applicant; rejection explains why", async () => {
    const owner = await openShop("kente-looms");
    const shop = await app().catalog.getSeller("kente-looms");
    expect(shop?.seller).toMatchObject({ name: "Kente Looms", verified: true, kind: "Maker" });
    expect(shop?.storefront?.exportsTo).toEqual(["GH"]);
    expect(await app().onboarding.memberships(owner)).toEqual([expect.objectContaining({ sellerId: "kente-looms", role: "owner" })]);
    const mine = await app().onboarding.mine(owner);
    expect(mine).toMatchObject({ status: "approved", sellerId: "kente-looms" });
    const topics = (await db.select().from(outbox)).map((e) => e.topic);
    expect(topics).toEqual(expect.arrayContaining(["ApplicationSubmitted", "ApplicationApproved"]));

    // Rejected: the applicant sees the note, edits, and can submit again.
    const other = newId();
    await app().onboarding.saveDetails(other, business("kente-three"), wallet);
    await uploadDocument(other, "business_license");
    await uploadDocument(other, "id_front");
    const s = await app().onboarding.submit(other);
    if (!s.ok) throw new Error("submit");
    expect((await app().onboarding.reject(newId(), s.value.id, "short")).ok).toBe(false);
    expect((await app().onboarding.reject(newId(), s.value.id, "The licence photo is blurry; upload a sharper one.")).ok).toBe(true);
    expect(await app().onboarding.mine(other)).toMatchObject({ status: "rejected", decisionNote: expect.stringMatching(/blurry/) });
    expect((await app().onboarding.saveDetails(other, business("kente-three"), wallet)).ok).toBe(true);
    expect((await app().onboarding.submit(other)).ok).toBe(true);
  });

  it("lets a shop list products with its own photos, publish them and archive them", async () => {
    await openShop("adinkra-prints");
    const selling = app().selling;
    const photo = await selling.startPhoto("adinkra-prints", "catalog", { contentType: "image/jpeg", bytes: 32 });
    if (!photo.ok) throw new Error(photo.error.message);
    await put(publicStorage, photo.value.url, new Uint8Array(32).fill(2));
    const input = {
      title: "Adinkra cotton print, 6 yards",
      categoryId: "fashion",
      images: [photo.value.photo],
      price: money.fromDollars(24),
      was: null,
      tiers: [{ minQty: 10, price: money.fromDollars(20) }],
      minOrder: 1,
      options: [],
      highlights: ["Hand-stamped", "  "],
      specs: [["Material", "Cotton"] as const],
      shipsFrom: "Kumasi",
      leadTime: { minDays: 3, maxDays: 6 },
      dutyRate: null,
      status: "draft" as const,
    };
    // Linking someone else's photo, or a photo that never finished uploading, is refused.
    expect((await selling.save("adinkra-prints", { ...input, images: ["https://example.com/x.jpg"] })).ok).toBe(false);
    expect((await selling.save("adinkra-prints", { ...input, images: ["/media/catalog/adinkra-prints/missing.jpg"] })).ok).toBe(false);

    const saved = await selling.save("adinkra-prints", input);
    if (!saved.ok) throw new Error(saved.error.message);
    expect(saved.value).toMatchObject({ slug: "adinkra-cotton-print-6-yards", status: "draft", price: 24, highlights: ["Hand-stamped"], rating: 0 });
    expect(saved.value.dutyRate).toBeGreaterThan(0);
    expect(await app().catalog.getProduct(saved.value.slug)).toBeNull();

    const live = await selling.setStatus("adinkra-prints", saved.value.id, "active");
    expect(live.ok).toBe(true);
    expect(await app().catalog.getProduct(saved.value.slug)).toMatchObject({ title: "Adinkra cotton print, 6 yards" });
    // Another shop can't touch it.
    expect((await selling.setStatus("sunvolt", saved.value.id, "archived")).ok).toBe(false);
    // A second listing with the same title gets its own address.
    const twin = await selling.save("adinkra-prints", input);
    expect(twin.ok && twin.value.slug).not.toBe(saved.value.slug);
    expect((await selling.listings("adinkra-prints")).length).toBe(2);
  });

  it("puts buyers' questions in the shop's inbox and publishes the answer", async () => {
    const actor = { accountId: newId(), name: "shopper-abc123", avatar: "" };
    const asked = await app().interactions.askQuestion(actor, "solar-panel-450w-bifacial", "Do these come with MC4 connectors?");
    if (!asked.ok) throw new Error(asked.error.message);
    const seller = (await app().catalog.getProduct("solar-panel-450w-bifacial"))!.sellerId;
    const inbox = await app().content.unansweredQuestions(seller);
    expect(inbox.map((q) => q.id)).toContain(asked.value.id);
    expect((await app().interactions.answerQuestion("voltgrid", asked.value.id, "Yes")).ok).toBe(false);
    const answered = await app().interactions.answerQuestion(seller, asked.value.id, "Yes, 1 m leads with MC4 on both.");
    expect(answered.ok && answered.value.answer).toBe("Yes, 1 m leads with MC4 on both.");
    expect((await app().content.questionsForProduct("solar-panel-450w-bifacial")).map((q) => q.id)).toContain(asked.value.id);
    expect((await app().content.unansweredQuestions(seller)).map((q) => q.id)).not.toContain(asked.value.id);
    expect((await app().interactions.answerQuestion(seller, asked.value.id, "Again")).ok).toBe(false);
  });
});
