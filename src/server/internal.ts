import "server-only";
import { timingSafeEqual } from "node:crypto";
import { serverEnv } from "@/config/server-env";
import { log } from "@/shared/infrastructure/log";

/** True when a request carries this deployment's internal token. */
export function isInternalRequest(request: Request) {
  const token = serverEnv.INTERNAL_TOKEN;
  const given = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!token || given.length !== token.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(token));
}

/**
 * Cache tags can only be revalidated inside a request (a Route Handler or Server Function),
 * so background jobs ask the app to do it over HTTP. Without INTERNAL_TOKEN this is skipped;
 * tagged data then refreshes when its cache life runs out.
 */
export async function revalidateTags(tags: readonly string[]) {
  if (!serverEnv.INTERNAL_TOKEN) {
    log.warn("INTERNAL_TOKEN is not set; cached data will refresh on its own schedule", { tags });
    return;
  }
  const base = serverEnv.INTERNAL_URL ?? `http://127.0.0.1:${process.env.PORT ?? 3000}`;
  const res = await fetch(new URL("/api/internal/revalidate", base), {
    method: "POST",
    headers: { authorization: `Bearer ${serverEnv.INTERNAL_TOKEN}`, "content-type": "application/json" },
    body: JSON.stringify({ tags }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`revalidate failed: ${res.status}`);
}
