import "server-only";
import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { serverEnv } from "@/config/server-env";
import { services } from "./container";

// MediaMTX posts { action, path, query, ... } for every publish and read. Publishing needs
// the show's stream key (in the WHIP URL's query); watching needs the show to be live.
// Everything else (its API, metrics, profiling) is refused. Only our media server may ask:
// its hook URL carries the internal token (?token=…).

const Ask = z.object({ action: z.string(), path: z.string().max(100), query: z.string().max(500).default("") });

function fromOurMediaServer(request: Request) {
  if (!serverEnv.INTERNAL_TOKEN) return serverEnv.NODE_ENV !== "production";
  const given = Buffer.from(new URL(request.url).searchParams.get("token") ?? "");
  const expected = Buffer.from(serverEnv.INTERNAL_TOKEN);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export async function mediaAuth(request: Request) {
  if (!fromOurMediaServer(request)) return new Response(null, { status: 403 });
  const parsed = Ask.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new Response(null, { status: 400 });
  const { action, path, query } = parsed.data;
  const live = (await services()).live;
  const ok =
    action === "publish"
      ? await live.mayPublish(path, new URLSearchParams(query).get("key") ?? "")
      : action === "read" || action === "playback"
        ? await live.mayRead(path)
        : false;
  return new Response(null, { status: ok ? 200 : 401 });
}
