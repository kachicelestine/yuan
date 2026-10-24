import { servePrivate } from "@/server/media";

/** GET /api/storage/file?key=…&exp=…&sig=… — a private document, through a link only reviewers get. */
export async function GET(request: Request) {
  return servePrivate(request);
}
