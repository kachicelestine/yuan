# 02 · How the giants scaled, and what transfers to us

The pattern across every case: **they started simple, scaled the database before anything else, split only along clear boundaries, and measured before changing.** Nobody at this scale started with microservices.

## Amazon: services, small teams, and a database built for peaks

- **Peak load, Prime Day 2024 (AWS official):** DynamoDB peaked at **146 million requests per second** with single-digit-millisecond latency. Aurora ran 6,311 database instances, processed 376 billion transactions and stored 2,978 TB ([AWS blog](https://aws.amazon.com/blogs/aws/how-aws-powered-prime-day-2024-for-record-breaking-sales)). A secondary source puts 2025 at 151M and 2026 at 192M requests per second ([PPC Land](https://ppc.land/prime-day-2026-lifted-amazons-aws-load-20-to-59-across-most-services/)).
- **How:** every team owns a service with its own data store, and teams talk only through APIs. Peak events are planned months ahead with load tests, and each tier is pre-scaled.
- **Transfers:** our bounded contexts already have their own Postgres schema and talk through `index.ts` ports. That's the same contract inside one process, and it's what lets a context become a service later without a rewrite.

## Shopify: a modular monolith at Black Friday scale

- **Peak load, BFCM 2025:** 489M requests a minute at the edge, 117M a minute on app servers, and a sales peak of $5.1M a minute ([Shopify press release / SEC](https://sec.gov/Archives/edgar/data/1594805/000159480525000090/a2025bfcmpressrelease.htm)). In 2024 that was 284M edge and 80M app per minute, with **10.5 trillion database queries** over the period.
- **How:**
  - **Kept the monolith, enforced boundaries.** Shopify kept one Rails codebase, split it into components, and enforced who may call whom with a static checker (Packwerk) ([Shopify Engineering](https://shopify.engineering/deconstructing-monolith-designing-software-maximizes-developer-productivity)).
  - **Scales the database by "pods"** (self-contained shards of shops; secondary).
  - **Rehearses:** five full-scale load tests from April to October at forecast peak, fixing each bottleneck (Kafka, memory, timeouts) before the real day ([Shopify, via Ecommerce Fastlane](https://ecommercefastlane.com/how-we-prepare-shopify-for-bfcm-2025-shopify/)).
- **Transfers:**
  - This is our architecture: one Next.js app, contexts under `src/modules`, and lint-enforced boundaries, our Packwerk.
  - Add **scale tests before every big sale** (11.11, Black Friday) to the operations roadmap.

## Alibaba: "cells" for Double 11

- **Peak load:**
  - Database: OceanBase peaked at 61M queries per second and 544k transactions per second in 2019 ([OceanBase](https://en.oceanbase.com/blog/2596694784)).
  - Orders: about 54k orders per second (secondary).
- **Unitized architecture (单元化):**
  - Business data is split into about 100 units by a key such as user ID. Each unit is about 1% of the service and runs its own copy of the business logic.
  - Shared data lives in a global zone, mirrored to each city.
  - Units fail independently, and multi-city active-active runs on Paxos consensus ([OceanBase talk](https://en.oceanbase.com/blog/2596911872)).
- **Transfers:** this is the end state (stage 3 in [05](05-infrastructure-free-to-faang.md)). The decision that makes it possible later is cheap now: **every row that belongs to a user, seller or order should carry the key we'd partition by** (account ID or seller ID), and cross-partition joins should be rare. Our schemas mostly do this already.

## AWS's generalisation: cell-based architecture

- **What a cell is:** a complete, independent copy of the workload with a fixed maximum size. A partition key routes each request to one cell, so a failure stays inside that cell ([AWS whitepaper](https://docs.aws.amazon.com/wellarchitected/latest/reducing-scope-of-impact-with-cell-based-architecture/reducing-scope-of-impact-with-cell-based-architecture.html)).
- **Shuffle sharding** gives each customer a random subset of instances. It can be used inside a cell, never across cells ([FAQ](https://docs.aws.amazon.com/wellarchitected/latest/reducing-scope-of-impact-with-cell-based-architecture/faq.html)).
- **Transfers:** pick the partition key early (account for buyers, seller for catalog and orders) and keep a "routing" layer thin.

## Instagram: Postgres goes a very long way

- **How:**
  - Chose sharded **PostgreSQL** over NoSQL.
  - Many logical shards are mapped onto fewer physical servers, so shards move without re-hashing.
  - IDs are generated inside Postgres: 41 bits of time, 13 bits of shard, 10 bits of sequence, which sort by time and say where they live ([Instagram Engineering](https://instagram-engineering.com/1cf5a71e5a5c)).
  - Peak later exceeded 10,000 likes per second on Postgres ([Instagram](https://instagram-engineering.com/handling-growth-with-postgres-5-tips-from-instagram-d5d7e7ffdfcb)).
- **Transfers:** our IDs are UUIDv7 (time-sortable, generated in the app), so they're already shard-friendly. Postgres will carry us far further than our growth will need for years.

## Notion and Figma: how to shard Postgres when the time comes

- **Notion:**
  - **Triggers:** VACUUM stalled and transaction-ID wraparound loomed.
  - **Design:** 480 logical shards (partitioned by workspace). In 2021 they ran on 32 physical databases with 15 shards each; in 2023, on 96 with 5 each, without changing the shard count.
  - **Sizing rules:** ≤500 GB per table, ≤10 TB per database, 60k+ IOPS.
  - **Migration safety:** double writes, then "dark reads" to compare, then verification scripts ([Notion](https://notion.com/blog/sharding-postgres-at-notion)).
- **Figma:**
  - **Step 1:** grew about 100x from one large Postgres by adding caching, read replicas and **vertical partitioning** (different tables on different databases).
  - **Step 2:** sharded horizontally:
    - "Logical sharding" first, routing as if sharded on one database using Postgres views.
    - Then physical moves.
    - A query proxy (DBProxy) that understands shard keys.
    - "Colos": groups of tables sharded together so joins still work ([Simon Willison](https://simonwillison.net/2024/Mar/14/how-figmas-databases-team-lived-to-tell-the-scale), [pganalyze](https://pganalyze.com/blog/5mins-postgres-figma-dbproxy-sharding-postgres)).
- **Transfers:** the ladder is **replicas → vertical partitioning (one database per bounded context; our `pgSchema`s map straight onto this) → logical shards → physical shards.** Managed options that skip building it ourselves: Citus, or PlanetScale's sharded Postgres "Neki" (announced, not GA at time of writing; [PlanetScale](https://planetscale.com/startups)).

## Discord: when a database hits its wall

- **History:** MongoDB → Cassandra (177 nodes, unpredictable latency from hot partitions and garbage-collection pauses) → **ScyllaDB**. The cluster shrank to 72 nodes, and p99 reads fell from 40–125 ms to 15 ms. A Rust data service also collapses duplicate concurrent reads ([ScyllaDB](https://resources.scylladb.com/blog/how-discord-stores-trillions-of-messages)).
- **Transfers:** live chat, comments and view events are append-heavy and huge. At stage 2–3 they belong in a wide-column store (ScyllaDB or Cassandra), Kafka plus a warehouse, or ClickHouse, not in the orders database. Request coalescing (many viewers asking for the same thing at once) is a pattern we already use in the photo cache.

## Walmart: own the platform layer

- **How:** a "triplet" hybrid cloud (own data centres, Azure, Google Cloud) behind one Walmart Cloud Native Platform for containers and VMs, plus about 10,000 edge nodes in stores ([InfoWorld](https://www.infoworld.com/article/3666468/how-walmart-abstracts-its-hybrid-cloud-for-developers.html)).
- **Transfers:** keep our deployment as plain Docker and Node, with no proprietary runtime, so we can move between Oracle, Hetzner, AWS, GCP or Vercel at will. Next.js's adapter API ([docs](https://nextjs.org/docs/app/guides/deploying-to-platforms)) and our "plain Node server" stance protect this.

## Meesho: cost discipline is an engineering requirement

- **How:** zero-commission marketplace economics work because logistics cost about ₹45 per order and server and support costs are kept minimal. Meesho is now investing about ₹1,390 crore to reduce dependence on external cloud vendors (IPO notes, secondary; [Zerodha](https://thedailybrief.zerodha.com/p/inside-meeshos-ipo)).
- **Transfers:** track **infrastructure cost per order and per 1,000 sessions** on a dashboard from stage 1. It decides when to move from managed services to self-run, and back.

## ByteDance: real-time recommendations (Monolith)

- **How:**
  - **Collisionless embeddings:** an embedding table (a cuckoo hashmap), so new IDs never collide, with frequency filtering and expiry to bound memory.
  - **Online training:** the model learns from new interactions and pushes parameter updates to serving within minutes.
  - **The trade-off:** the paper shows you can give up some reliability for faster learning, and that shorter sync intervals improve results.
  - Deployed in BytePlus Recommend ([arXiv:2209.07663](https://arxiv.org/abs/2209.07663)).
- **Transfers:** this is stage-3 machinery. The day-1 lesson is that freshness matters. Log interactions as events, recompute "trending" and "similar" often, and design the feed API so a smarter ranker can replace the simple one without touching the client.

## Meta and Pinterest: the funnel and the graph

- **Meta, Instagram Explore:** retrieval (up to about 1,500 candidates from several sources), then a first-stage two-tower ranker (about 100), then a second-stage multi-task model, then rule-based reranking for safety and diversity. Caching and precomputing embeddings is what makes the heavy models affordable ([Meta engineering](https://engineering.fb.com/2023/08/09/ml-applications/scaling-instagram-explore-recommendations-system/)).
- **Pinterest, PinSage:** a graph neural network over about 3 billion pins and boards. It uses random walks to choose neighbours, and was trained on 7.5 billion examples ([arXiv:1806.01973](https://arxiv.org/abs/1806.01973)).
- **Transfers:** our graph (buyer ↔ product ↔ seller ↔ video ↔ note ↔ board) is already rich. "Bought together", "saved together" and "watched together" edges are the cheapest strong signals we have.

## Patterns we adopt now (and what we don't)

**Adopt now:**
- Modular monolith with enforced boundaries; one Postgres schema per context.
- Time-sortable IDs.
- Cache reads at the edge and in `"use cache"`; invalidate by tag.
- An outbox table for events (see [04](04-commerce-core.md)), so a bus can be added later without changing write paths.
- Log every interaction (impression, watch-seconds, tap, add-to-bag) to an append-only events store from day one.
- Load tests before big sales; cost-per-order dashboards.

**Not yet, and the trigger that changes it:**

| Not yet | Adopt when |
|---|---|
| Microservices | Separate teams need separate deploy cadence, or one context needs very different scaling |
| Kafka | More than one consumer per event at volume; Postgres outbox polling can't keep up |
| Sharding | The database nears ~1–2 TB or VACUUM struggles; read replicas and vertical splits come first |
| Cells and multi-region | Regional latency or regulatory residency forces it, or a single-region outage becomes unaffordable |
| Online-trained recommendations | Enough interaction volume that minutes-fresh models measurably beat hourly batch |
