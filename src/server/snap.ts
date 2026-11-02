import "server-only";
import { ThinkingLevel } from "@google/genai";
import { z } from "zod";
import { serverEnv } from "@/config/server-env";
import type { ProductView, SearchCriteria } from "@/modules/catalog";
import { log } from "@/shared/infrastructure/log";
import { searchCatalog } from "./catalog";
import { answerText, gemini, type GeminiModel } from "./gemini";

// Snap to search: Gemini looks at the photo and says what it is in a few search words;
// the catalog search does the rest. The photo isn't stored.

const snapLog = log.child({ scope: "snap" });

export const MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export type SnapMediaType = (typeof MEDIA_TYPES)[number];

export type SnapDeps = {
  model: GeminiModel;
  modelId: string;
  search(criteria: SearchCriteria): Promise<ProductView[]>;
};

const liveDeps = (): SnapDeps => ({ model: gemini(), modelId: serverEnv.ASK_MODEL, search: searchCatalog });

const Reading = z.object({ product: z.boolean(), name: z.string().max(80), query: z.string().max(120) });

const PROMPT = `Look at the photo a shopper took and work out the one product they want to find on a marketplace of shops and factories in China.
Reply with:
- product: false if there's no clear product in the photo (a person, a landscape, a screenshot of text), else true;
- name: a short, plain name for it, e.g. "Over-ear wireless headphones";
- query: 2 to 5 search words a shopper would type for it, e.g. "wireless headphones over-ear". No brand names, even if one is visible.`;

export type SnapResult = { found: false } | { found: true; name: string; query: string; products: ProductView[] };

/** What the photo shows, and the listings that match it. */
export async function snap(image: { data: string; mediaType: SnapMediaType }, deps: SnapDeps = liveDeps()): Promise<SnapResult> {
  const response = await deps.model.generateContent({
    model: deps.modelId,
    contents: [{ role: "user", parts: [{ inlineData: { mimeType: image.mediaType, data: image.data } }, { text: PROMPT }] }],
    config: {
      maxOutputTokens: 2048,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
      responseMimeType: "application/json",
      responseJsonSchema: { type: "object", properties: { product: { type: "boolean" }, name: { type: "string" }, query: { type: "string" } }, required: ["product", "name", "query"], additionalProperties: false },
    },
  });
  let parsed: z.infer<typeof Reading>;
  try {
    parsed = Reading.parse(JSON.parse(answerText(response)));
  } catch {
    snapLog.warn("unreadable answer", { stop: response.candidates?.[0]?.finishReason });
    return { found: false };
  }
  if (!parsed.product || !parsed.query.trim()) return { found: false };
  const products = await deps.search({ text: parsed.query, sort: "best", limit: 8 });
  return { found: true, name: parsed.name, query: parsed.query, products };
}
