import type Anthropic from "@anthropic-ai/sdk";
import { beforeAll, describe, expect, it } from "vitest";
import { SimulatedNetwork } from "@/modules/payments/infrastructure/networks";
import { openDatabase, type Database } from "@/shared/infrastructure/database";
import { wire } from "./container";
import { seedAll } from "./seed";
import { snap, type SnapDeps } from "./snap";

// Photo search: the model's reading of the photo becomes a real catalog search. The
// model is scripted here; this checks the plumbing, not what Claude sees.
describe("snap to search", () => {
  let db: Database;
  const now = new Date("2026-10-25T10:00:00Z");
  const app = () => wire(db, { clock: { now: () => now }, payments: { network: new SimulatedNetwork(db), simulator: null } });
  const image = { data: "aGVsbG8=", mediaType: "image/jpeg" as const };

  function reads(text: string) {
    const calls: Anthropic.MessageCreateParamsNonStreaming[] = [];
    const deps: SnapDeps = {
      modelId: "test",
      search: (c) => app().searchProducts(c),
      model: {
        messages: {
          async create(params) {
            calls.push(params);
            return { content: [{ type: "text", text, citations: null }], stop_reason: "end_turn" } as unknown as Anthropic.Message;
          },
        },
      },
    };
    return { deps, calls };
  }

  beforeAll(async () => {
    db = await openDatabase({ kind: "memory" });
    await seedAll(db, now);
  });

  it("searches the catalog for what the photo shows", async () => {
    const { deps, calls } = reads(JSON.stringify({ product: true, name: "Portable power bank", query: "power bank" }));
    const r = await snap(image, deps);
    expect(r.found && r.name).toBe("Portable power bank");
    expect(r.found && r.products.some((p) => p.slug === "power-bank-20k")).toBe(true);
    // The photo went to the model as an image, with a structured-output schema.
    const content = calls[0].messages[0].content as Anthropic.ContentBlockParam[];
    expect(content[0]).toMatchObject({ type: "image", source: { type: "base64", media_type: "image/jpeg" } });
    expect(calls[0].output_config?.format?.type).toBe("json_schema");
  });

  it("says so when there's no product, or the answer is unreadable", async () => {
    expect(await snap(image, reads(JSON.stringify({ product: false, name: "", query: "" })).deps)).toEqual({ found: false });
    expect(await snap(image, reads("not json").deps)).toEqual({ found: false });
  });
});
