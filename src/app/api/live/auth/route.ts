import { mediaAuth } from "@/server/live-auth";

/**
 * POST /api/live/auth — the media server (MediaMTX, authMethod: http) asks before anyone
 * publishes or watches. 200 allows, 401 refuses.
 */
export async function POST(request: Request) {
  return mediaAuth(request);
}
