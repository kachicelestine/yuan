# 03 · Feed, video and live

## The recommendation system

### How the big feeds work

Every large feed (TikTok, Instagram, YouTube, Pinterest) has the same funnel:

```
all items ──retrieval──▶ ~1,000s ──light ranker──▶ ~100s ──heavy ranker──▶ ~10s ──rules──▶ page
            (cheap, many            (two-tower,            (multi-task:            (diversity,
             sources)                precomputed)           watch, like,             safety, ads,
                                                            buy, skip)               freshness)
```

- **Retrieval** runs several cheap sources in parallel: who you follow, collaborative filtering ("people who watched X also watched Y"), graph walks, trending in your country, embedding nearest-neighbours. Meta's Explore pulls up to about 1,500 candidates this way ([Meta](https://transparency.meta.com/features/explaining-ranking/ig-explore/)).
- **Ranking** predicts several outcomes at once and combines them with weights the business chooses. For example: P(watch past 50%) × w1 + P(like) × w2 + P(add to bag) × w3 − P(skip within 2 s) × w4.
- **Signals that matter most:**
  - **Strongest:** interactions, meaning watch-through, replays, shares, comments, follows, purchases, and "not interested".
  - **Next:** item features such as captions, sounds and category.
  - **Lowest weight:** device and account settings ([TikTok](https://newsroom.tiktok.com/en-us/how-tiktok-recommends-videos-for-you/)).
- **Freshness.** ByteDance's Monolith trains online and pushes updates to serving within minutes, and found that shorter sync intervals improve the model ([arXiv:2209.07663](https://arxiv.org/abs/2209.07663)).

### Our path, one rung per stage

| Stage | Ranker | Infrastructure | Why it's enough |
|---|---|---|---|
| 0 (now) | Rules: recency × popularity × your interests (feed prefs, saves, category lean) + diversity (no two adjacent from the same seller) + exploration slots | Postgres queries, cached per segment | With <10k users there isn't enough data to learn from; good rules beat a starved model |
| 1 | Item-to-item collaborative filtering ("watched/saved/bought together"), recomputed hourly; trending per country | Nightly/hourly batch job writing `similar_items` tables | Strongest cheap signal; makes "more like this" real |
| 2 | Two-tower embeddings (user and item vectors) + nearest-neighbour retrieval; a gradient-boosted or small neural ranker for the top few hundred | `pgvector` (HNSW index) or Qdrant; training in Python on a schedule; features from the event log | The standard industry baseline; learns taste beyond categories |
| 3 | Multi-task deep ranker, real-time features, online learning (Monolith-style) | Feature store, Kafka + Flink, GPU training/serving | Only pays off at millions of daily users |

**Managed options** if we'd rather buy than build stage 1–2: Recombee, Shaped, or open-source Gorse (self-hosted) ([Recombee reviews](https://wiserreview.com/blog/recombee-alternatives/), [Gorse docs](https://gorse.io/zh/docs/concepts/ranking)). They save months but cost per request and own a critical piece of the product. Build stage 0–1 ourselves; decide at stage 2.

### What to do now (cheap, irreversible if skipped)

1. **Log events from day one:** an append-only `engagement.events` table (or a log shipped to a warehouse later) with account or anonymous ID, item, event type (impression, view start, watch-ms, complete, replay, like, share, save, add-to-bag, purchase, not-interested), surface, position and timestamp. Models can be rebuilt; lost history can't.
2. **One feed API** (`GET /api/feed?cursor=`) that returns item IDs plus "why" reasons. The client never ranks, so the ranker can change underneath.
3. **Exploration:** reserve about 10% of slots for new or under-shown items (new sellers' cold start), and measure them separately.
4. **Guardrails as rules, last:** de-duplicate, cap repeats per seller, label ads, honour "not interested" immediately, and enforce safety blocks.
5. **Evaluation:** an A/B test framework (PostHog feature flags cover this for free; [PostHog](https://posthog.com/pricing)), and metrics per variant: watch time per session, completion rate, GMV per 1,000 impressions, seller diversity.

## Short-video pipeline

### Shape

```
phone ──upload (resumable, direct to R2 with presigned URL)──▶ R2 "originals"
      ──job──▶ ffmpeg: probe, normalise audio, encode ladder, poster frame, 2 s preview
      ──▶ R2 "hls/<video>/…" (CMAF segments + playlists) ──▶ Cloudflare CDN ──▶ player
```

- **Packaging.** Use HLS with CMAF fMP4 segments, so one set of segments serves HLS and DASH. Apple's authoring spec targets about 6 s segments with a keyframe every 2 s, aligned across renditions ([BlazingCDN summary](https://blog.blazingcdn.com/en-us/hls-encoding-segment-length-keyframes-and-renditions)). For short clips, start-up time beats efficiency: use about 2 s segments so the first frame comes from a tiny first download.
- **Ladder for vertical 9:16 short video (starting point; tune with real content):**

  | Rendition | Size | Target bitrate (H.264) |
  |---|---|---|
  | Low | 360×640 | ~0.5–0.7 Mbps |
  | Mid | 540×960 | ~1.0–1.4 Mbps |
  | High | 720×1280 | ~1.8–2.5 Mbps |
  | (later) Full | 1080×1920 | ~3.5–4.5 Mbps |

  General VOD guides put landscape 720p at 2.5–4 Mbps ([Dacast](https://dacast.com/blog/encoder-settings-hls-live-streaming)). Vertical short-form needs less because there are fewer pixels and the audience is mostly on phones.
- **Codecs.** H.264 is the only codec that needs no fallback. HEVC adds about 15–25% savings, with hardware decode on roughly 75–85% of sessions; AV1 saves 30–40% versus H.264, with hardware decode on roughly 45–65% (2026 estimates, [BlazingCDN](https://blog.blazingcdn.com/en-us/av1-codec-for-streaming-bandwidth-savings-vs-encoding-cost)). Ship H.264 first and add AV1 for popular videos only (encode cost is high).
- **Player.** Use native HLS on iOS and Safari, and hls.js elsewhere on web. Preload the poster and first segment of the next one or two videos only. One player plays at a time, and players are recycled (see the native app section).

### What it costs: self-run vs managed

Assume 30-second clips, three renditions (~4 Mbps combined, ~15 MB stored per clip), and 1 million views a month at an average of ~1.5 Mbps watched (~5.6 MB per view, ~5.6 TB a month).

| Option | Storage (1,000 clips) | Delivery (1M views) | Notes |
|---|---|---|---|
| **Self-transcode + R2 + Cloudflare CDN** | 15 GB → ~$0.08/month beyond 10 GB free | **$0** egress ([R2](https://developers.cloudflare.com/r2/pricing/)); CDN cache absorbs most segment reads | Allowed under Cloudflare's terms because the files are on R2 ([Cloudflare](https://blog.cloudflare.com/updated-tos/)). Cost is our CPU (encoding about 1–3x real time per rendition on ARM) and our time |
| Cloudflare Stream | 500 min → $2.50/month ($5 per 1,000 min stored) | 500k min → **$500** ($1 per 1,000 min) | Encoding free ([Stream pricing](https://developers.cloudflare.com/stream/pricing)) |
| Bunny Stream | ~$0.15/month (from $0.01/GB) | ~5.6 TB × from $0.005/GB ≈ **$28+** | Standard encoding free ([Bunny](https://bunny.net/pricing/stream/)) |
| Mux | Free plan: 10 assets, 100k delivered min/month | Paid beyond | Best developer experience; the free plan is a demo ([Mux](https://www.mux.com/docs/changelog/video-free-plan)) |

**Recommendation:** self-transcode to R2 for stages 0–1, and keep the encode job behind a port (`VideoProcessor`) so Bunny or Stream can replace it. Run encoding as a background job, never in a request.

### The viewer's data bill

Mobile data costs about $0.39/GB in Nigeria and $0.40/GB in Ghana (Cable.co.uk, via [Prime Business Africa](https://www.primebusiness.africa/zimbabwe-tops-list-of-africas-most-expensive-mobile-data-as-nigeria-ranks-among-cheapest/); other analyses of the same survey differ). A 30 s clip at 1.5 Mbps is about 5.6 MB, so 100 clips ≈ 560 MB ≈ $0.22 to the viewer. **Ship a "data saver" setting** (cap at the low rendition on cellular, no autoplay preload) and default to it where data is expensive. Prefer AV1 and HEVC where the device decodes them in hardware.

## Live shopping

### Latency vs scale

| Protocol | Glass-to-glass | Scale | Use for |
|---|---|---|---|
| WebRTC (SFU) | ~0.2–0.5 s | ~100–500 viewers per SFU node before cascading | Host, guests, auctions, Q&A on stage |
| LL-HLS | ~2–5 s (vendor reports 4–7 s) | CDN scale, cheap | Large audiences watching |
| HLS | 10–30 s | CDN scale | Replays |

Sources: [Fora Soft](https://www.forasoft.com/blog/article/webrtc-video-steaming-app-vs-hls), [OpenVidu](https://openvidu.io/blog/2026/09/01/low-latency-live-streaming/). The standard design is **hybrid**: WebRTC for the host and anyone bidding, LL-HLS for everyone else. Bid and price state stays authoritative on the server, so a 3 s video delay never decides an auction.

### Providers

| Provider | Free | Paid | Notes |
|---|---|---|---|
| LiveKit Cloud | 5,000 WebRTC minutes, 100 concurrent, 50 GB egress | Ship $50/month (150k min); Scale $500 | Open source; can self-host the same server later ([LiveKit](https://livekit.com/pricing.md)) |
| Amazon IVS | – | Real-time $0.072 per participant-hour; low-latency HD output $0.072, Full HD $0.144 per viewer-hour (first 10k h, North America) | A live-shopping app went from 8 s to under 300 ms with it ([AWS](https://aws.amazon.com/blogs/media/live-shopping-platform-voggt-reduces-live-stream-latency-with-amazon-ivs); prices via [VideoSDK](https://videosdk.live/blog/amazon-ivs-pricing-and-alternatives), secondary) |
| Cloudflare Stream Live | – | Same per-minute rates as Stream | Simple ingest; HLS output |
| Self-hosted (LiveKit + an LL-HLS packager to R2) | VM cost | – | Cheapest at scale, most ops |

**Cost reality check:** 1,000 viewers for 1 hour on IVS low-latency HD is ~1,000 viewer-hours × $0.072 ≈ **$72 per show-hour**. Live is where costs can explode. So:
- Start with LiveKit's free tier for host-side WebRTC.
- Serve viewers LL-HLS from R2 and Cloudflare (egress free).
- Move to a managed product only for the shows that make money.

### Live chat, bids, reactions

These are high-fan-out, short-lived and append-only. They need a WebSocket service, not Postgres, and the options by stage are:
- **Stage 0–1:** one Node WebSocket process with Valkey pub/sub, or Cloudflare Durable Objects (free tier 100k requests a day, 5 GB storage; [Cloudflare](https://developers.cloudflare.com/durable-objects/platform/limits)).
- **Stage 2+:** a dedicated real-time tier, with chat stored in a wide-column store (see Discord in [02](02-how-the-giants-scaled.md)).

Bids and orders still go through the ordering context and its transactions.

## The native app question

- The PWA is right for now: one codebase, installable, and we've tuned it (see ARCHITECTURE decision 13).
- A TikTok-grade feed on low-end Android needs native video:
  - recycled players;
  - one decoder at a time;
  - preloading the next clip;
  - smooth 60 fps paging.
- The proven React path is **Expo + FlashList + `expo-video`**: a virtualised pager, a preload strategy, and only one active player ([Mux guide](https://www.mux.com/blog/slop-social), [Expo case study](https://expo.dev/blog/shipping-a-performance-first-video-feed-how-tendbble-built-a-real-time-social-app-with-expo)). It isn't free of rough edges: Android flicker on swipe has been reported with Expo SDK 54 ([forum](https://forum.cursor.com/t/need-architectural-review-android-expo-video-flicker-in-tiktok-style-feed/164359)).
- **Plan:**
  1. Keep the domain and API in this repo (server actions → route handlers for the app).
  2. Share types.
  3. Build the Expo app at stage 1–2 once the feed API and video pipeline are stable.
