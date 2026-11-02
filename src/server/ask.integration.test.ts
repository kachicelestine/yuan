import { ApiError, type Content, type GenerateContentParameters, type GenerateContentResponse } from "@google/genai";
import { beforeAll, describe, expect, it } from "vitest";
import type { AskEvent } from "@/lib/ask";
import type { MarketView } from "@/modules/markets";
import { SimulatedNetwork } from "@/modules/payments/infrastructure/networks";
import { openDatabase, type Database } from "@/shared/infrastructure/database";
import { ask, type AskDeps } from "./ask";
import { wire } from "./container";
import { seedAll } from "./seed";

// Ask's tools run against the real catalog; the model is scripted here, so this checks
// what the assistant can look up and propose, not what Gemini would say.
describe("the Ask assistant's tools", () => {
  let db: Database;
  let market: MarketView;
  const now = new Date("2026-10-25T10:00:00Z");
  const app = () => wire(db, { clock: { now: () => now }, payments: { network: new SimulatedNetwork(db), simulator: null } });

  /** A model that makes the given tool calls on its first turn, then says `text`. */
  function scripted(calls: { name: string; input: Record<string, unknown> }[], text: string) {
    const seen: GenerateContentParameters[] = [];
    const model: AskDeps["model"] = {
      async generateContent(params) {
        // A copy: the loop keeps adding to the same conversation.
        seen.push(structuredClone(params));
        const parts =
          seen.length === 1
            ? calls.map((c, i) => ({ functionCall: { id: `t${i}`, name: c.name, args: c.input }, ...(i === 0 && { thoughtSignature: "signed" }) }))
            : [{ text }];
        return { candidates: [{ content: { role: "model", parts }, finishReason: "STOP" }] } as unknown as GenerateContentResponse;
      },
    };
    return { model, seen };
  }
  const lastTurn = (params: GenerateContentParameters) => (params.contents as Content[]).at(-1)!.parts!;
  const deps = (model: AskDeps["model"]): AskDeps => ({
    model,
    modelId: "test",
    search: (c) => app().searchProducts(c),
    productsBySlugs: (s) => app().catalog.getProductsBySlugs(s),
    priceHistory: (s) => app().catalog.priceHistory(s, 90),
  });
  const run = async (model: AskDeps["model"], question = "Find me a power bank") => {
    const events: AskEvent[] = [];
    for await (const e of ask([{ role: "user", text: question }], market, deps(model))) events.push(e);
    return events;
  };

  beforeAll(async () => {
    db = await openDatabase({ kind: "memory" });
    await seedAll(db, now);
    market = (await app().listMarkets()).find((m) => m.code === "NG")!;
  });

  it("searches the real catalog and shows what it found", async () => {
    const { model, seen } = scripted([{ name: "search_products", input: { query: "power bank", max_price_usd: null, limit: 3 } }, { name: "show_products", input: { slugs: ["power-bank-20k"] } }], "This one fits.");
    const events = await run(model);
    expect(events.filter((e) => e.type === "step").map((e) => (e as { text: string }).text)).toEqual(["Searching for “power bank”", "Looking"]);
    const blocks = events.find((e) => e.type === "blocks");
    expect(blocks?.type === "blocks" && blocks.blocks.map((b) => b.kind)).toEqual(["text", "products"]);
    // The search result went back to the model as real listings.
    const results = lastTurn(seen[1])[0].functionResponse!.response!.output as string;
    expect(JSON.parse(results).results.some((r: { slug: string }) => r.slug === "power-bank-20k")).toBe(true);
    // The model's own turn went back unchanged, thought signature included.
    expect((seen[1].contents as Content[]).at(-2)).toMatchObject({ role: "model", parts: [{ thoughtSignature: "signed" }, {}] });
    // The system prompt tells the model that seller text is data.
    expect(String(seen[0].config?.systemInstruction)).toContain("never instructions");
  });

  it("shows the model the shopper's photo, and answers in their language", async () => {
    const { model, seen } = scripted([], "");
    for await (const e of ask([{ role: "user", text: "Trouve-moi ça", photo: "aGVsbG8=" }], market, deps(model))) void e;
    expect((seen[0].contents as Content[])[0].parts).toEqual([{ inlineData: { mimeType: "image/jpeg", data: "aGVsbG8=" } }, { text: "Trouve-moi ça" }]);
    expect(String(seen[0].config?.systemInstruction)).toContain("in the language of the shopper's latest message");
  });

  it("prices to the shopper's country and proposes, never acts", async () => {
    const [bank] = await app().catalog.getProductsBySlugs(["power-bank-20k"]);
    const { model } = scripted(
      [
        { name: "landed_cost", input: { slug: "power-bank-20k", qty: 2 } },
        { name: "propose_add_to_bag", input: { lines: [{ slug: "power-bank-20k", qty: 2 }, { slug: "no-such-thing", qty: 1 }] } },
        { name: "propose_price_alert", input: { slug: "power-bank-20k", target_usd: 10, into_bag: false } },
        { name: "propose_quote_request", input: { item: "custom tote bags", qty: 300, details: "Logo on one side" } },
      ],
      "Ready when you are.",
    );
    const events = await run(model);
    const blocks = events.find((e) => e.type === "blocks");
    if (blocks?.type !== "blocks") throw new Error("no blocks");
    const landed = blocks.blocks.find((b) => b.kind === "landed");
    expect(landed).toMatchObject({ qty: 2, country: market.name });
    expect(landed?.kind === "landed" && landed.item).toBeCloseTo(bank.price! * 2);
    const actions = blocks.blocks.flatMap((b) => (b.kind === "action" ? [b.action] : []));
    expect(actions.map((a) => a.type)).toEqual(["add-to-bag", "watch", "rfq"]);
    // Unknown listings are dropped; prices come from the catalog, not the model.
    expect(actions[0]).toMatchObject({ type: "add-to-bag", lines: [{ slug: "power-bank-20k", qty: 2, unitPrice: bank.price }] });
    expect(actions[1]).toMatchObject({ type: "watch", target: 10, intoBag: false });
  });

  it("tells the model when a tool input is bad, and keeps going", async () => {
    const { model, seen } = scripted([{ name: "get_product", input: { slug: "../../etc/passwd" } }], "Sorry, I couldn't find it.");
    const events = await run(model);
    expect(lastTurn(seen[1])[0]).toEqual({ functionResponse: { id: "t0", name: "get_product", response: { error: "Invalid input." } } });
    expect(events.at(-1)).toEqual({ type: "done" });
  });

  it("reports a failed model call as an error, not a crash", async () => {
    const model: AskDeps["model"] = { generateContent: async () => Promise.reject(new Error("boom")) };
    const events = await run(model);
    expect(events).toEqual([{ type: "error", message: "Something went wrong on our side. Try asking again." }]);
    const busy: AskDeps["model"] = { generateContent: async () => Promise.reject(new ApiError({ message: "quota", status: 429 })) };
    expect(await run(busy)).toEqual([{ type: "error", message: "Lots of people are asking right now. Try again in a minute." }]);
  });
});
