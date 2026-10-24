export type TrustProxy = "cloudflare" | "proxy" | "none";

/**
 * The visitor's IP, from the one header our edge sets: Cloudflare's CF-Connecting-IP, or the
 * first X-Forwarded-For hop from our own reverse proxy. Anything else is spoofable, so with
 * no trusted proxy every visitor counts as "unknown" (which still rate-limits as a group).
 */
export function clientIpFrom(headers: Pick<Headers, "get">, trust: TrustProxy): string {
  const raw = trust === "cloudflare" ? headers.get("cf-connecting-ip") : trust === "proxy" ? headers.get("x-forwarded-for")?.split(",")[0] : null;
  const ip = raw?.trim() ?? "";
  // IPv4 or IPv6 characters only; never let a header smuggle text into a rate-limit key.
  return /^[0-9a-fA-F:.]{2,45}$/.test(ip) ? ip : "unknown";
}
