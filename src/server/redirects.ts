/**
 * A same-site path to go to after signing in. Anything else (other sites, "//evil",
 * backslash tricks) falls back to the home page, so the link can't be used to phish.
 */
export function safeNext(value: string | string[] | undefined, fallback = "/") {
  const next = Array.isArray(value) ? value[0] : value;
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\") || /[\u0000-\u001f]/.test(next)) return fallback;
  return next;
}
