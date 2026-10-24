# Research: building a TikTok × Amazon marketplace that starts free and scales to FAANG level

Researched 24 October 2026. Prices, free tiers and laws move fast; every figure links to its source, and anything taken from a secondary source (blogs, aggregators) is marked as such. Re-check a number before you spend money on it.

## The documents

| | Covers |
|---|---|
| [01 Landscape](01-landscape.md) | How TikTok Shop, Douyin, Xiaohongshu, Whatnot, Amazon, Walmart, Temu, Shein, Shopee, Meesho, Mercado Libre and Jumia make money, and what each teaches us |
| [02 How the giants scaled](02-how-the-giants-scaled.md) | Engineering case studies: Amazon, Shopify, Alibaba, Instagram, Notion, Figma, Discord, Walmart, Meesho, ByteDance, Meta, Pinterest |
| [03 Feed, video and live](03-feed-video-live.md) | Recommendation systems, the short-video pipeline, live streaming, and the mobile app question |
| [04 Commerce core](04-commerce-core.md) | Catalog, search, checkout, stablecoin payments, order workflows, cross-border logistics, trust and ads |
| [05 Infrastructure: free to FAANG](05-infrastructure-free-to-faang.md) | What Next.js needs to scale, every free tier that matters (and its catches), and a stage-by-stage plan with costs and triggers |
| [06 Risks and compliance](06-risks-compliance.md) | Crypto rules, marketplace laws, customs, data protection, content safety |
| [Sources](sources.md) | Everything cited, grouped by topic |

## Executive summary

**1. Next.js is not the scaling limit.** Next.js 16 needs only "a Node.js server. That's it" to run every feature, including Cache Components ([Next.js: deploying to platforms](https://nextjs.org/docs/app/guides/deploying-to-platforms), also bundled at `node_modules/next/dist/docs/01-app/02-guides/`). Going from one server to many needs three things: a shared cache (`cacheHandler` for ISR, `cacheHandlers` for `"use cache"`), one `NEXT_SERVER_ACTIONS_ENCRYPTION_KEY` across instances, and a `deploymentId` so a deploy doesn't break pages already open. Shopify ran Black Friday 2025 at 117 million requests a minute on a Rails monolith with enforced module boundaries ([Shopify](https://sec.gov/Archives/edgar/data/1594805/000159480525000090/a2025bfcmpressrelease.htm)); our modular monolith is the same bet. What actually limits scale is the database, video delivery and the feed's ranking system, in that order.

**2. "Free until profitable" is possible, but not on Vercel.** Vercel's Hobby plan forbids "any method of requesting or processing payment" ([Vercel fair use](https://vercel.com/docs/limits/fair-use-guidelines)), so a store can't run there free. Cloudflare Workers' free plan allows commercial use but gives 10 ms of CPU per request ([Cloudflare limits](https://developers.cloudflare.com/workers/platform/limits/)), too little for server rendering, and the OpenNext adapter still has open bugs with Cache Components on Next 16.3–16.4 ([issue #1450](https://github.com/opennextjs/opennextjs-cloudflare/issues/1450)). The $0 setup that works today:
- one Oracle Cloud Always Free ARM server (now 2 OCPU and 12 GB, with 10 TB/month egress; [Oracle](https://docs.oracle.com/en-us/iaas/Content/FreeTier/freetier_topic-Always_Free_Resources.htm)) running Next.js, Postgres and Valkey in Docker;
- behind Cloudflare's free CDN;
- with media in Cloudflare R2 (10 GB free, egress always free; [R2 pricing](https://developers.cloudflare.com/r2/pricing/)).

It has no redundancy, which is acceptable before revenue and not after. Plan details are in [05](05-infrastructure-free-to-faang.md).

**3. Video is the cost that can sink us, and also where we can be cheapest.** Cloudflare's terms let you serve video through the free CDN only when the files live on a Cloudflare service such as R2 ([Cloudflare](https://blog.cloudflare.com/updated-tos/)). R2 egress is free, so videos we transcode ourselves into HLS (with ffmpeg) and store in R2 cost storage only, however often they're watched. Managed options cost per minute:
- Cloudflare Stream: $1 per 1,000 minutes delivered.
- Mux: free plan holds 10 videos.
- Amazon IVS live: $0.072–0.144 per viewer-hour.

Self-transcoding is the right start. A managed service becomes worth it when an engineer's time costs more than the bill.

**4. The feed is the product, and it learns from interactions, not content.** TikTok ranks on watch-through, replays, shares and skips, and gives lower weight to device and account settings ([TikTok](https://newsroom.tiktok.com/en-us/how-tiktok-recommends-videos-for-you/)). ByteDance's published system retrains its model within minutes of new interactions ([Monolith, arXiv:2209.07663](https://arxiv.org/abs/2209.07663)). Meta's Explore narrows a pool of up to 1,500 candidates in stages to a ranked page ([Meta](https://transparency.meta.com/features/explaining-ranking/ig-explore/)). We should start simply and add one layer per stage of growth:
1. Recency, popularity and diversity rules.
2. Collaborative filtering.
3. Two-tower embeddings with nearest-neighbour search in Postgres (pgvector).
4. Real-time online learning.

What matters on day one is logging every impression and watch-second, because that data can't be recreated later.

**5. Content and commerce are converging, and the money is in ads and creators.**
- On Douyin, "shelf" search-and-browse sales grew to about half of e-commerce GMV ([36Kr via KrASIA](https://kr-asia.com/pulses/157556)).
- Affiliate creators drive roughly 42% of TikTok Shop's US GMV (secondary sources, [01](01-landscape.md)).
- Amazon's ad revenue reached $17.2 billion in Q1 2026 (secondary).
- Walmart's advertising grew 37% in Q1 FY27, and advertising plus membership is now about a third of its operating income (secondary).
- Shopee's take rate rose to about 13% on ad growth (secondary).

So we should plan sponsored listings and a creator affiliate programme from the start, not bolt them on.

**6. Our target markets reward a different playbook.**
- Jumia narrowed to four countries and put profit before scale. Its sales from international (often Chinese) sellers grew 36% in Q2 2025 ([Jumia Q2 2025](https://www.newswire.com/news/jumia-reports-second-quarter-2025-results)).
- Meesho runs on rock-bottom cost per order: logistics fell to about ₹45 per order, and it charges sellers no commission (secondary).
- Air freight from China to Lagos runs about $6.1/kg and takes 5–8 days; a consolidator charges about $10.5/kg for 10 business days (forwarder quotes, [04](04-commerce-core.md)).

The lesson: build for all 249 countries, but launch and win in a few, keep the cost per order fanatically low, and consolidate parcels.

**7. Regulation is now a design input.** Each of these shapes product and data design ([06](06-risks-compliance.md)):
- The US suspended duty-free de minimis for all countries from 29 August 2025, and it's now indefinite ([KPMG](https://kpmg.com/us/en/taxnewsflash/news/2026/06/cbp-suspends-de-minimis-exemption.html)).
- The EU added a €3 duty per item on low-value parcels from 1 July 2026 (secondary).
- Nigeria's Investments and Securities Act 2025 treats virtual assets as securities under SEC oversight ([Mondaq](https://www.mondaq.com/nigeria/securities/1619460/isa-2025-what-investors-need-to-know-about-nigerias-new-capital-market-law)).
- The EU's DSA requires marketplaces to verify trader identity (Art. 30), with an exemption for small platforms.

## Recommended path (detail in [05](05-infrastructure-free-to-faang.md))

| Stage | When | Runs on | Monthly cost |
|---|---|---|---|
| 0. Prove it | Pre-revenue, fewer than ~10k users a day | One Oracle Always Free ARM server running Next.js, Postgres and Valkey in Docker, behind the Cloudflare free CDN, with media in R2 and free monitoring tiers | **$0** (plus a domain) |
| 1. First revenue | Paying customers, uptime matters | Two app servers (or Vercel Pro), managed Postgres with point-in-time recovery, Valkey as a shared Next.js cache, a job queue, self-transcoded video in R2 | **~$50–300** |
| 2. Growth | ~100k+ users a day, a team of 5–20 | Containers on AWS or GCP, Postgres with read replicas, Typesense or OpenSearch, an event bus fed by an outbox table, a ranking service, managed live video, a data warehouse | **~$2k–20k** |
| 3. Scale | Millions a day, several regions | Cells partitioned by region and user, sharded Postgres or distributed SQL, Kafka, real-time recommendations, multi-CDN, SRE practices with error budgets | **$50k+**, funded by revenue |

Each stage is triggered by measured limits (CPU, p95 latency, database size, on-call pain), not by the calendar. Skipping ahead burns money; staying too long burns customers.

## Decisions for you

1. **Hosting at stage 0:** self-host on Oracle Always Free plus Cloudflare ($0, more work, single point of failure), or Vercel Pro ($20/month plus usage, least work, allowed for commercial use).
2. **Payment rails:** stablecoins only (current decision), or add mobile money or cards in launch markets. Bitcoin is 89% of crypto purchases in Nigeria, and stablecoins are about 43% of the region's crypto volume ([04](04-commerce-core.md)). Many buyers will still expect M-Pesa, MTN MoMo or bank transfer.
3. **Launch markets:** keep "all countries" in the product, but choose 2–4 launch countries for marketing, logistics partners and support. Nigeria, Ghana and Kenya fit the current design.
4. **Seller verification provider:** the DSA and fraud control need identity checks on sellers. An Africa-focused provider such as Smile ID, or a global one such as Persona or Sumsub, needs choosing before sellers onboard.
5. **Native app timing:** PWA first (we have it), then an Expo app that shares API and types. A TikTok-grade feed needs native video playback ([03](03-feed-video-live.md)).
