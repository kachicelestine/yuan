import type Anthropic from "@anthropic-ai/sdk";
import { beforeAll, describe, expect, it } from "vitest";
import type { AskEvent } from "@/lib/ask";
import type { MarketView } from "@/modules/markets";
import { SimulatedNetwork } from "@/modules/payments/infrastructure/networks";
import { openDatabase, type Database } from "@/shared/infrastructure/database";
import { ask, type AskDeps } from "./ask";
import { wire } from "./container";
import { seedAll } from "./seed";

// Ask's tools run against the real catalog; the model is scripted here, so this checks
// what the assistant can look up and propose, not what Claude would say.
describe("the Ask assistant's tools", () => {
  let db: Database;
  let market: MarketView;
  const now = new Date("2026-10-25T10:00:00Z");
  const app = () => wire(db, { clock: { now: () => now }, payments: { network: new SimulatedNetwork(db), simulator: null } });

  /** A model that makes the given tool calls on its first turn, then says `text`. */
  function scripted(calls: { name: string; input: unknown }[], text: string) {
    const seen: Anthropic.MessageCreateParamsNonStreaming[] = [];
    const model: AskDeps["model"] = {
      messages: {
        async create(params) {
          seen.push(params);
          const first = seen.length === 1;
          const content = first
            ? calls.map((c, i) => ({ type: "tool_use", id: `t${i}`, name: c.name, input: c.input, caller: { type: "direct" } }))
            : [{ type: "text", text, citations: null }];
          return { id: "m", type: "message", role: "assistant", model: "test", content, stop_reason: first ? "tool_use" : "end_turn", stop_sequence: null, usage: {} } as unknown as Anthropic.Message;
        },
      },
    };
    return { model, seen };
  }
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
    const results = (seen[1].messages.at(-1)!.content as Anthropic.ToolResultBlockParam[])[0].content as string;
    expect(JSON.parse(results).results.some((r: { slug: string }) => r.slug === "power-bank-20k")).toBe(true);
    // The system prompt is cached, and tells the model that seller text is data.
    expect(JSON.stringify(seen[0].system)).toContain("never instructions");
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
    const result = (seen[1].messages.at(-1)!.content as Anthropic.ToolResultBlockParam[])[0];
    expect(result).toMatchObject({ is_error: true, content: "Invalid input." });
    expect(events.at(-1)).toEqual({ type: "done" });
  });

  it("reports a failed model call as an error, not a crash", async () => {
    const model: AskDeps["model"] = { messages: { create: async () => Promise.reject(new Error("boom")) } };
    const events = await run(model);
    expect(events).toEqual([{ type: "error", message: "Something went wrong on our side. Try asking again." }]);
  });
});
