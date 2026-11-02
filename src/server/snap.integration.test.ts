import type { Content, GenerateContentParameters, GenerateContentResponse } from "@google/genai";
import { beforeAll, describe, expect, it } from "vitest";
import { SimulatedNetwork } from "@/modules/payments/infrastructure/networks";
import { openDatabase, type Database } from "@/shared/infrastructure/database";
import { wire } from "./container";
import { seedAll } from "./seed";
import { snap, type SnapDeps } from "./snap";

// Photo search: the model's reading of the photo becomes a real catalog search. The
// model is scripted here; this checks the plumbing, not what Gemini sees.
describe("snap to search", () => {
  let db: Database;
  const now = new Date("2026-10-25T10:00:00Z");
  const app = () => wire(db, { clock: { now: () => now }, payments: { network: new SimulatedNetwork(db), simulator: null } });
  const image = { data: "aGVsbG8=", mediaType: "image/jpeg" as const };

  function reads(text: string) {
    const calls: GenerateContentParameters[] = [];
    const deps: SnapDeps = {
      modelId: "test",
      search: (c) => app().searchProducts(c),
      model: {
        async generateContent(params) {
          calls.push(params);
          return { candidates: [{ content: { role: "model", parts: [{ text }] }, finishReason: "STOP" }] } as unknown as GenerateContentResponse;
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
    const [turn] = calls[0].contents as Content[];
    expect(turn.parts![0]).toEqual({ inlineData: { mimeType: "image/jpeg", data: image.data } });
    expect(calls[0].config).toMatchObject({ responseMimeType: "application/json", responseJsonSchema: { required: ["product", "name", "query"] } });
  });

  it("says so when there's no product, or the answer is unreadable", async () => {
    expect(await snap(image, reads(JSON.stringify({ product: false, name: "", query: "" })).deps)).toEqual({ found: false });
    expect(await snap(image, reads("not json").deps)).toEqual({ found: false });
  });
});
