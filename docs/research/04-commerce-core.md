# 04 · Commerce core: catalog to doorstep

What a TikTok-plus-Amazon marketplace needs behind the feed, what we have, and how each part scales.

## Catalog and search

**We have:** products, options, tiers and sellers in Postgres, and full-text search with stemming and synonyms (ARCHITECTURE decision 7, ROADMAP "Search").

**Search scaling ladder:**

| Stage | Engine | Moves to the next rung when |
|---|---|---|
| 0–1 | **Postgres full-text + trigram** (what we have) | Catalog passes ~100k–500k products, typo tolerance or faceting gets slow, or search load competes with checkout |
| 2 | **Typesense** or **Meilisearch** (self-hosted free; Typesense Cloud from ~$7/month, no per-query fees; dataset must fit in RAM) ([comparison](https://blog.elest.io/meilisearch-vs-typesense-vs-algolia-which-search-engine-fits-your-stack/), secondary) | Merchandising, learning-to-rank, multilingual and huge catalogs |
| 3 | **OpenSearch** or **Vespa** (ranking in the engine, vectors and text together) | – |

Algolia is the managed alternative: excellent, but metered pricing "rewards small catalogs and punishes growth" ([Sacra](https://sacra.com/chat/h/b539c7aa-1823-4667-8e08-a87a1e79679b/)).

**Rules that hold at every rung:**
- Postgres stays the source of truth; the search index is a projection fed by events (outbox).
- Ranking blends text match with commerce signals (conversion rate, rating, delivery speed to *your* country, seller quality) and sponsored slots, clearly labelled.
- Log every query and its clicks: search analytics is the cheapest roadmap you'll ever get.

## Inventory, reservation and the bag

- **Inventory:** decrement with a single conditional `UPDATE … WHERE available >= qty RETURNING`, the same pattern as our coupon reservation, so two checkouts can't oversell. Reserve stock at checkout and release it when the invoice lapses (we already do this for coupons).
- **Hot items:** flash deals and live-auction items get thousands of attempts a second. Their inventory is pre-split into buckets, or kept in Valkey with a Lua script and settled to Postgres. Alibaba and JD both shard hot SKUs this way.
- **Bag:** server-side per account (done), merged at sign-in, priced by the server at read.

## Checkout and payments

**We have:**
- stablecoin invoices (USDC on Base/Solana, USDT on Tron);
- unique amounts;
- on-chain verification for Base;
- a double-entry ledger with escrow;
- coupon reserve, spend and release.

**Market facts:**
- **Stablecoins:** about 43% of Sub-Saharan Africa's crypto volume, with Nigeria taking about 40% of the region's stablecoin inflows (Chainalysis via [AllBusiness](https://allbusiness.africa/insights/africa-crypto-stablecoins-2026), secondary).
- **Bitcoin:** still 89% of crypto *purchases* in Nigeria. Sub-Saharan Africa received about $205B on-chain in the year to June 2025, $92.1B of it in Nigeria ([Tech Africa](https://tech.africa/sub-saharan-africa-crypto-205bn/)).
- **Stripe:** USDC on Base works for Shopify merchants in 34 countries, settling to local currency or to a wallet. Stripe's Bridge offers stablecoin accounts across about 100 countries ([Stripe newsroom](https://stripe.com/ae/newsroom/news/shopify-stripe-stablecoin-payments), [a16z](https://a16z.com/newsletter/what-stripes-acquisition-of-bridge-means-for-fintech-and-stablecoins-april-2025-fintech-newsletter/)). A processor can take over chain monitoring and off-ramping if self-running becomes a burden.
- **USDT under regulation:** EU exchanges delisted USDT under MiCA in 2025, and proposed US Treasury rules under the GENIUS Act could restrict foreign-issued stablecoins from 2027 ([Unchained](https://unchainedcrypto.com/treasurys-new-stablecoin-rule-could-force-us-exchanges-to-delist-tether)). **Offer USDC everywhere and USDT only where it's lawful**; `availableRails` should become country-aware.

**Recommendation:** keep stablecoins as the core (they're our cross-border and escrow advantage) and keep the `PaymentNetwork` port open for local rails later, such as mobile money (M-Pesa, MTN MoMo) and bank transfer via an aggregator. Most buyers in launch markets will ask for them; refusing them caps conversion. This is a business decision (see the README).

## Orders: workflows that survive crashes

An order is a long-running process: placed → paid → seller confirms → packed → consolidated → shipped → customs → delivered → escrow released, or cancelled, refunded or disputed. Each step can fail or wait days.

**Ladder:**

1. **Now: transactional outbox.** Write the state change and an `outbox` row in one transaction. A worker polls the outbox and runs side effects (emails, search index, notifications) idempotently. This removes the "database committed, event lost" bug class entirely. Polling suits early stages; change-data capture (Debezium reading Postgres's logical replication) is for low latency at volume ([Conduktor](https://www.conduktor.io/blog/transactional-outbox-pattern-database-kafka.md), [AxonOps](https://axonops.com/docs/data-platforms/kafka/application-development/patterns/outbox/)). Key events by order ID to keep per-order ordering.
2. **Durable workflow engine for multi-day flows** (escrow release after delivery plus a protection window, payout retries, dispute timers):
   - Inngest: free tier about 50k step runs a month.
   - Trigger.dev: free tier 10k runs a month; Apache-2.0, self-hostable.
   - Temporal: the heavyweight, self-hosted or Cloud.

   Free-tier figures are secondary ([Automation Atlas](https://automationatlas.io/answers/trigger-dev-vs-inngest-2026/)). For us, start with a Postgres-backed job table plus cron (zero cost), and adopt a workflow engine when timers and retries multiply.
3. **Kafka (or Redpanda)** only when several consumers need the same events at volume (stage 2–3).

## Cross-border logistics: China → Africa

**Rates and transit, as of late 2026 (forwarder and consolidator quotes; indicative):**

| Lane | Air | Express | Consolidator, door-to-door | Sea |
|---|---|---|---|---|
| China → Lagos | ~$6.1/kg, 5–8 days to airport | ~$12.8/kg, 9–14 days | GIG: $10.5/kg regular (1 kg minimum), ~10 business days | LCL ~$435/cbm; ~50–55 business days |
| China → Ghana | – | – | GIG: ~12 business days regular | ~50–55 business days |
| China → Kenya | ~$13/kg (undated) | – | Aquantuo: ~15 business days | ~60 days |

Sources: [Sino Shipping](https://www.sino-shipping.com/freight-china-nigeria/), [GIG Logistics](https://globalshipping.giglogistics.com/shipping-from-china-to-nigeria-ghana/), [Aquantuo](https://aquantuo.com/blog-detail/international-shipping-from-china-to-africa-a-complete-guide).

**What it implies:**
- **Consolidation is the product.** Our "combine parcels" option (one box at our hub) is where most of the margin and the buyer's savings come from: one kg minimum per parcel × many small orders is expensive.
- **Duties shown up front** (we do landed cost by country) and collected at checkout (DDP) cut refused deliveries.
- **Two fulfilment modes per listing:** ships from China (cheap, slow) and ships from a local warehouse (fast, pre-stocked by the seller). This is Temu's semi-managed hedge, and it's also what makes "arrives in 2 days" possible for bestsellers.
- **Partner, don't build** (stage 0–2): Chinese consolidators with hubs in Guangzhou and Yiwu plus last-mile partners per country (e.g. GIG in Nigeria and Ghana). Our ordering context should model *shipments* and *parcels* separately from orders, with tracking events from partners via webhooks.

## Trust and safety

- **Seller verification (KYC/KYB):** required in practice for fraud and payouts, and by the EU DSA for platforms with EU buyers (Art. 30: collect and verify trader identity, payment account, registration and a self-certification; suspend on false data; micro and small platforms are exempt; [Mondaq](https://mondaq.co.uk/compliance/1367256/online-marketplaces-and-the-digital-services-act-understanding-trader-traceability), [CCPC](https://www.ccpc.ie/enforcement-and-regulation/digital/the-digital-services-act)). Use a provider (Smile ID for African IDs; Persona or Sumsub globally) behind an `IdentityVerifier` port.
- **Counterfeits:** our rule "factory alternatives, never counterfeits" needs enforcement. That means keyword and brand-term filters at listing time, image similarity against known brand assets, a rights-holder report-and-takedown flow, and penalties per seller.
- **Content moderation:** feeds, notes, comments and live need automated screening plus human review. Options include text moderation (OpenAI's moderation endpoint, reported free or nearly so; Perspective API free under quota), images and video (AWS Rekognition, Hive, Sightengine, per call), and live (frame sampling plus a reporting flow) ([AI Prompts Hub](https://aipromptshub.co/safety/ai-content-moderation-cost-by-provider), secondary). Child-safety obligations are covered in [06](06-risks-compliance.md).
- **Reviews:** only verified buyers review (we tie reviews to orders); detect review rings via shared devices and payment wallets.
- **Escrow is our trust feature:** buyer funds are held until delivery plus the Protect window (ARCHITECTURE decision 8). It's also our dispute lever over sellers.

## Monetisation built into the core

1. **Commission** per order, varied by category (TikTok Shop's US referral fee is about 6% in most categories; secondary).
2. **Sponsored listings and sponsored videos** in search and the feed. These are the profit engine at Amazon, Walmart and Shopee ([01](01-landscape.md)). They need an auction (cost-per-click or cost per 1,000 impressions), budgets, pacing, and honest labelling.
3. **Affiliate commissions** for creators, paid from the seller's side, with attribution windows. We need link and attribution tracking and payouts through the ledger.
4. **Logistics margin** on consolidation (the Meesho model).
5. **Later:** membership (free express, as our "Jade" tier hints) and seller financing using sales history (the Mercado Libre model).
