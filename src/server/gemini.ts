import "server-only";
import { GoogleGenAI, type GenerateContentParameters, type GenerateContentResponse } from "@google/genai";
import { serverEnv } from "@/config/server-env";

// Ask, photo search and translation all talk to Gemini through this one client.

/** The one call the features make (swappable in tests). */
export type GeminiModel = { generateContent(params: GenerateContentParameters): Promise<GenerateContentResponse> };

export const geminiEnabled = () => !!serverEnv.GEMINI_API_KEY;

let client: GoogleGenAI | null = null;
export const gemini = (): GeminiModel => (client ??= new GoogleGenAI({ apiKey: serverEnv.GEMINI_API_KEY })).models;

/** The answer's text, without the model's thoughts. */
export function answerText(response: GenerateContentResponse) {
  const parts = response.candidates?.[0]?.content?.parts ?? [];
  return parts.flatMap((p) => (p.text && !p.thought ? [p.text] : [])).join("");
}
