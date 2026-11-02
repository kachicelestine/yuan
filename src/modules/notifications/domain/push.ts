/** A browser someone turned alerts on in. Its keys encrypt each alert, so only that browser can read it. */
export type PushDevice = Readonly<{ endpoint: string; accountId: string; p256dh: string; auth: string; createdAt: Date }>;

/** What a browser shows, and where tapping it goes. */
export type PushAlert = Readonly<{ title: string; body: string; link: string | null }>;

// Browsers each use their maker's push service.
const PUSH_HOSTS = new Set(["fcm.googleapis.com", "updates.push.services.mozilla.com", "web.push.apple.com"]);
const PUSH_DOMAIN = ".notify.windows.com";

/**
 * True for an address on a browser maker's push service. The address comes from the
 * browser and the server posts to it, so anything else could aim the server at a private
 * address.
 */
export function isPushEndpoint(endpoint: string) {
  if (!URL.canParse(endpoint)) return false;
  const { protocol, hostname, port, username, password } = new URL(endpoint);
  return protocol === "https:" && !port && !username && !password && (PUSH_HOSTS.has(hostname) || hostname.endsWith(PUSH_DOMAIN));
}
