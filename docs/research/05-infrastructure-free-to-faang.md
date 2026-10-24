# 05 · Infrastructure: from $0 to FAANG-grade

## What Next.js actually needs

From the Next.js 16 docs bundled with our install (`node_modules/next/dist/docs/01-app/02-guides/deploying-to-platforms.md` and `self-hosting.md`; online at [nextjs.org](https://nextjs.org/docs/app/guides/self-hosting)):

- **"To run Next.js, your platform needs a Node.js server. That's it."** One `next start` process supports everything: Server Components, ISR, Partial Prerendering, Cache Components, Server Actions, Proxy and `after()`. Streaming must not be buffered by any proxy in front (set `X-Accel-Buffering: no` for nginx).
- **More than one instance** needs:
  1. **A shared cache.** Use `cacheHandler` for ISR, route handlers and images, and `cacheHandlers` for `"use cache"` entries (with `"use cache: remote"` for data that must be shared). The store must be reachable by every instance (e.g. Valkey/Redis), bounded, serialise `Buffer` and `Map`, and index entries by tag so `revalidateTag` reaches every instance. Community Redis handlers are listed in the official [Redis example](https://github.com/vercel/next.js/blob/canary/examples/cache-handler-redis/README.md).
  2. **The same `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY`** on every instance. Otherwise you get "Failed to find Server Action".
  3. **A `deploymentId`.** During a rolling deploy, a client on the old version gets a full reload instead of a broken navigation.
  4. **A consistent build ID** across containers, and **graceful shutdown** so `after()` work finishes.
- **Platforms** plug in through the public **Deployment Adapter API**. "Verified adapters" are open source and pass the Next.js compatibility suite. Most community adapters deploy Next.js as a Node server or container.
- **Cloudflare via OpenNext:** functional, but users report open issues with `cacheComponents` on Next 16.3–16.4 (HTTP 500 / Error 1101 under concurrent requests; a cross-request `"use cache"` dedupe hang) ([#1450](https://github.com/opennextjs/opennextjs-cloudflare/issues/1450), [#1464](https://github.com/opennextjs/opennextjs-cloudflare/issues/1464), [vercel/next.js#100122](https://github.com/vercel/next.js/issues/100122)). **Don't move the main app to Workers until those close**; Workers are still great for small edge jobs.

**Implication:** our scaling plan is about the *things around* Next.js (database, cache, media, workers). The app server itself scales horizontally once the four items above are in place.

## Free tiers that matter (verified 24 October 2026)

| Service | Free allowance | Catch | Commercial use |
|---|---|---|---|
| **Vercel Hobby** | 100 GB transfer, 1M function invocations, 4 h active CPU, 5k image transforms a month | Personal, non-commercial only: "any method of requesting or processing payment" is commercial ([Vercel](https://vercel.com/docs/limits/fair-use-guidelines)) | **No** |
| Vercel Pro | $20/month incl. $20 usage credit, then usage-based | Bills grow with function CPU and transfer | Yes |
| **Cloudflare CDN, DNS, WAF** (Free) | Unlimited CDN bandwidth for web content | Video and large files only if hosted on Cloudflare (R2, Stream, Images) ([Cloudflare terms post](https://blog.cloudflare.com/updated-tos/)) | Yes |
| **Cloudflare R2** | 10 GB-month, 1M Class A + 10M Class B ops a month; **egress always free** | Beyond: $0.015/GB-month, $4.50/M writes, $0.36/M reads ([R2](https://developers.cloudflare.com/r2/pricing/)) | Yes |
| Cloudflare Workers | 100k requests/day, **10 ms CPU** per request | Paid: $5/month incl. 10M requests + 30M CPU-ms ([Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/)) | Yes |
| Cloudflare Durable Objects / Queues | 100k requests/day, 5 GB SQL / 10k queue ops a day | Good for live chat rooms and small queues ([limits](https://developers.cloudflare.com/durable-objects/platform/limits)) | Yes |
| **Oracle Cloud Always Free** | **2 OCPU + 12 GB** Ampere ARM (cut from 4/24 in mid-2026), 200 GB block storage, **10 TB/month egress**, 2 small Autonomous DBs | Home region only; "out of host capacity" at times; idle instances (CPU p95, network *and* memory all <20% for 7 days) may be reclaimed ([Oracle](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)) | Yes |
| Google Cloud Run | 2M requests, 180k vCPU-s, 360k GiB-s a month (request-based) | Scale-to-zero means cold starts; keeping one warm costs money ([pricing](https://cloud.google.com/run/pricing)) | Yes |
| AWS | $100 credit (+$100 by onboarding tasks), Free plan ends after 6 months or when credits run out ([AWS](https://aws.amazon.com/about-aws/whats-new/2025/07/aws-free-tier-credits-month-free-plan/)) | Not a permanent home | Yes |
| Neon Postgres | 0.5 GB per project, ~100 CU-hours, scale-to-zero after 5 min (secondary: [Jet Admin](https://www.jetadmin.io/blog/neon-pricing/amp/)) | Tiny storage; cold starts | Yes |
| Supabase | 500 MB DB, 1 GB files, 50k MAU, 2 projects | **Pauses after a week of inactivity** (secondary: [Jet Admin](https://www.jetadmin.io/blog/supabase-pricing-2026-guide-to-plans-limits-and-real-world-costs/)) | Yes |
| Upstash Redis | 500k commands a month, 256 MB | Queues and caches burn commands fast ([Upstash](https://upstash.com/blog/redis-new-pricing)) | Yes |
| Resend (email) | 3,000 a month, **100 a day** (secondary) | The daily cap hits sign-in codes first; Amazon SES is the cheap step up | Yes |
| Sentry (errors) | ~5k errors a month, 1 user (secondary) | – | Yes |
| PostHog (analytics, flags, replay) | 1M events, 5k replays, 100k exceptions a month ([PostHog](https://posthog.com/pricing)) | – | Yes |
| Grafana Cloud | 10k metric series, 50 GB logs, 50 GB traces, 14-day retention (secondary) | – | Yes |
| LiveKit Cloud (live video) | 5,000 WebRTC minutes, 100 concurrent, 50 GB egress ([LiveKit](https://livekit.com/pricing.md)) | Requests fail past the quota until reset | Yes |
| Mux (video) | 10 stored assets, 100k delivered minutes ([Mux](https://www.mux.com/docs/changelog/video-free-plan)) | A demo, not a home | Yes |
| Inngest / Trigger.dev (jobs) | ~50k step runs / 10k runs a month (secondary) | – | Yes |

Paid-but-cheap alternatives to know:
- **Hetzner** raised prices twice in 2026; its smallest ARM server is about €4.49–5.99 a month, and availability was limited in August 2026 (secondary; [WZ-IT](https://wz-it.com/en/blog/hetzner-price-increase-june-2026-cpx-ccx-alternatives/), [Findstack](https://findstack.com/resources/hetzner-price-increase-2026)).
- **PlanetScale Postgres** starts at $5/month for a single node and $15 for 3-node HA (secondary; [Bytebase](https://www.bytebase.com/blog/postgres-hosting-options-pricing-comparison/)).

## Stage 0: prove it ($0)

```
 users ──▶ Cloudflare (free: DNS, TLS, CDN, WAF rules, Turnstile, R2)
              │ static + /_next/static + photos (cached at edge)      │ video HLS + uploads
              ▼                                                       ▼
   Oracle Always Free ARM VM (2 OCPU / 12 GB / 200 GB)            R2 buckets
   ┌──────────────── docker compose ───────────────┐            (media, backups)
   │ Caddy (TLS origin cert, streaming unbuffered) │
   │ Next.js (output: standalone, next start)      │
   │ worker: outbox, emails, ffmpeg video jobs     │
   │ Postgres 18 + WAL archiving to R2             │
   │ Valkey (cache handler, rate limits, pub/sub)  │
   └───────────────────────────────────────────────┘
   CI: GitHub Actions builds an arm64 image → GHCR → deploy over SSH (or Kamal)
   Observability: Sentry free, PostHog free, Grafana Cloud free, an uptime pinger
```

- **Why this and not Vercel Hobby or Workers:** it's allowed for commercial use, runs every Next.js feature (plain Node), and needs no rewrites. The same Docker image later runs anywhere.
- **Memory budget (12 GB):**

  | Component | Memory |
  |---|---|
  | Postgres `shared_buffers` | ~3 GB |
  | Next.js | ~0.5–1 GB |
  | Valkey | ~0.5 GB |
  | Worker and ffmpeg | ~1–2 GB |
  | Page cache | the rest |

  This also keeps memory use above Oracle's 20% "idle" threshold.
- **Video:** the worker transcodes uploads to HLS and writes to R2, which Cloudflare serves for free ([03](03-feed-video-live.md)).
- **Backups:** nightly base backup plus continuous WAL to R2 (pgBackRest or WAL-G, both S3-compatible). Test a restore monthly. This is non-negotiable even at $0.
- **Limits:** one machine, one region, no failover. A host failure means hours of downtime (restore from R2). Fine before revenue; this is the first thing stage 1 fixes.
- **Email:** Resend free for sign-in codes. At more than 100 a day, switch the `Mailer` adapter to SES or a paid plan.
- **Capacity guess:** with our static shells, CDN caching and `"use cache"`, one 2-OCPU ARM box serves roughly thousands of dynamic requests a minute. That's plenty until about 10k daily active users. **Measure, don't trust this:** a k6 or autocannon load test is part of stage 0.

**Alternative stage 0 if time beats money:** Vercel Pro ($20/month) + Neon or Supabase free/low tier + R2 + Upstash. Least ops, commercial-OK, but costs scale with traffic and the free databases are tiny.

## Stage 1: first revenue (~$50–300/month)

**Trigger:** paying customers, or any outage that costs real orders.

| Concern | Do |
|---|---|
| App availability | 2+ app servers (Oracle pay-as-you-go, Hetzner, DigitalOcean, or a managed platform such as Render/Railway/Fly), or Vercel Pro. Cloudflare load balancing or DNS health checks |
| Next.js multi-instance | The four items at the top: Valkey-backed `cacheHandler`/`cacheHandlers`, shared encryption key, `deploymentId`, graceful shutdown |
| Database | Managed Postgres with point-in-time recovery and an HA replica (Neon Launch, Supabase Pro ~$25, PlanetScale Postgres $15+ HA), or self-managed primary + replica + pgBackRest |
| Jobs | Separate worker process(es); Postgres job table + outbox, or Inngest/Trigger.dev |
| Video | Still self-transcoded to R2; consider Bunny Stream if encoding eats ops time |
| Live | LiveKit Cloud (Build → Ship $50) for hosts; viewers on LL-HLS via R2/CDN |
| Security | Cloudflare WAF and rate limiting rules on auth and checkout; per-IP limits in the app (roadmap "Operations") |
| Ops | Status page, on-call rota (even if it's one person), runbooks for restore, deploy rollback and key rotation |
| Money | Dashboard of **infrastructure cost per order** and per 1,000 sessions ([Meesho lesson](02-how-the-giants-scaled.md#meesho-cost-discipline-is-an-engineering-requirement)) |

## Stage 2: growth (~$2k–20k/month)

**Trigger:** about 100k+ daily users, a team of 5–20, database CPU regularly above 60%, or search and feed load hurting checkout.

- **Compute:** containers on AWS (ECS/EKS) or GCP (Cloud Run/GKE) close to users. Africa regions exist on AWS (Cape Town) and GCP (Johannesburg). The Next.js app scales horizontally behind a load balancer; workers scale on queue depth.
- **Data:**
  - Postgres (Aurora/AlloyDB/RDS or Crunchy/PlanetScale) with **read replicas** and PgBouncer.
  - Then **vertical partitioning**: one database per bounded context, which our per-context `pgSchema`s map directly onto ([Figma's path](02-how-the-giants-scaled.md#notion-and-figma-how-to-shard-postgres-when-the-time-comes)).
- **Events:** outbox → CDC (Debezium) → Kafka/Redpanda or a managed pub/sub. Consumers: search index, recommendations, notifications, analytics.
- **Search:** Typesense or Meilisearch cluster, fed from events.
- **Analytics:** a warehouse (BigQuery or ClickHouse) fed from the event log; product analytics stays in PostHog.
- **Recommendations:** a Python ranking service; two-tower embeddings in pgvector or Qdrant; hourly training; A/B tests ([03](03-feed-video-live.md)).
- **Media:** managed live (IVS/LiveKit) for monetised shows; AV1 for top videos.
- **Platform:** infrastructure as code (Terraform/OpenTofu); separate staging and production; feature flags; progressive rollouts; SLOs on checkout and feed; error budgets ([Google SRE book](https://sre.google/sre-book/table-of-contents/)).
- **Compliance:** SOC 2 groundwork; data-processing agreements; data residency where required ([06](06-risks-compliance.md)).
- **Peak readiness:** Shopify-style scale tests at forecast peak before every big sale (11.11, Black Friday) ([02](02-how-the-giants-scaled.md#shopify-a-modular-monolith-at-black-friday-scale)).

## Stage 3: FAANG-grade ($50k+/month, funded by revenue)

**Trigger:** millions of daily users across continents, regulatory data residency, or a single region's outage becoming unaffordable.

- **Cells:** independent, size-capped copies of the stack. A partition key (account or seller) routes each request; failures stay in one cell. Shuffle sharding inside cells only ([AWS](https://docs.aws.amazon.com/wellarchitected/latest/reducing-scope-of-impact-with-cell-based-architecture/reducing-scope-of-impact-with-cell-based-architecture.html); [Alibaba units](02-how-the-giants-scaled.md#alibaba-cells-for-double-11)).
- **Multi-region active-active:** for example Lagos or Johannesburg, Frankfurt, Virginia and Singapore, with global tables (catalog, sellers) replicated and user-owned data homed in the user's region.
- **Data:** sharded Postgres (Citus, PlanetScale Neki, or a Notion/Figma-style router), or distributed SQL (Spanner, CockroachDB, YugabyteDB, TiDB) for global data. A wide-column store (ScyllaDB/Cassandra) for chat, views and feeds ([Discord](02-how-the-giants-scaled.md#discord-when-a-database-hits-its-wall)). Kafka as the backbone; Flink for real-time features.
- **Machine learning:** feature store, online training (Monolith-style), GPU inference for ranking and the shopping agent.
- **Edge:** multi-CDN, our own video origin shield, and Points of Presence in Africa via the CDN's local PoPs.
- **Reliability:** SRE with SLOs per user journey, chaos engineering and game days, automated failover drills, blast-radius limits on deploys.
- **Org:** an internal developer platform (Walmart's WCNP, Mercado Libre's Fury), platform and product teams, FinOps.

## When to move: measurable triggers

| Signal | Threshold (start acting) | Action |
|---|---|---|
| App CPU p95 | >60% at daily peak | Add an instance (stage 1+) |
| Checkout p95 latency | >800 ms | Profile; read replica; cache |
| Postgres size | >100 GB / >1 TB | Managed HA / vertical partitioning |
| Postgres CPU | >60% sustained | Replicas, query fixes, then partitioning |
| VACUUM lag, wraparound warnings | Any | Urgent: partition hot tables ([Notion](02-how-the-giants-scaled.md#notion-and-figma-how-to-shard-postgres-when-the-time-comes)) |
| Email | >100 a day | Paid email provider |
| Video encode queue | >15 min backlog | More worker CPU or managed encoding |
| Live viewers per show | >~500 | LL-HLS fan-out via CDN; managed live for paid shows |
| Infrastructure cost per order | Rising 3 months in a row | Re-architect the hot spot before scaling it |

## Cheap now, painful later: do these in the next sprints

1. `output: "standalone"` and a multi-arch (arm64 + amd64) Dockerfile; `GET /api/health` (database plus cache check); graceful shutdown.
2. Set `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` and `deploymentId` from CI. A Valkey `cacheHandlers` behind an env flag, tested with two instances.
3. Outbox table + worker; append-only engagement events ([03](03-feed-video-live.md#what-to-do-now-cheap-irreversible-if-skipped)).
4. A `MediaStorage` port with an R2 adapter (presigned uploads); a `VideoProcessor` port with an ffmpeg worker.
5. Backups to R2 with a tested restore; structured logs with request IDs; OpenTelemetry via `instrumentation.ts`.
6. Rate limits (Cloudflare rules + app) on sign-in, checkout and search; Turnstile on sign-in.
