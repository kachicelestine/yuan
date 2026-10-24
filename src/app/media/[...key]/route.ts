import type { NextRequest } from "next/server";
import { serveMedia } from "@/server/media";

/** GET /media/videos/<id>/720.mp4 — files kept on this server's disk (STORAGE=local). */
export async function GET(request: NextRequest, { params }: RouteContext<"/media/[...key]">) {
  return serveMedia((await params).key.join("/"), request.headers.get("range"));
}
