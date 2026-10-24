# 01 · Landscape: who sells what, how, and what we should copy

Figures are the latest found on 24 October 2026. "Secondary" means a blog or aggregator rather than the company or a filing; treat those as directional.

## The shape of the market

Two models are merging:

- **Content commerce ("discovery").** People don't arrive with a shopping list. A video, live show or note creates the want, and the purchase happens in the same app. Examples: TikTok Shop, Douyin, Kuaishou, Xiaohongshu, Whatnot, Instagram and YouTube Shopping.
- **Shelf commerce ("search").** People arrive knowing what they want, so search, price, reviews and delivery speed win. Examples: Amazon, Walmart, Taobao, Shopee, Jumia, Mercado Libre.

The winners do both. Douyin built "shelf" search and storefronts on top of its video feed, and shelf grew to roughly half of its e-commerce GMV. Amazon and Walmart went the other way, adding video, creators and AI shopping agents to search. **Our product (a feed plus a full marketplace) sits exactly where they're converging.**

## Social and content commerce

### TikTok Shop

- **Scale:** global GMV is estimated at about $64–66B in 2025, with projections near $112B for 2026 ([Hubfluence](https://www.hubfluence.io/blog/tiktok-shop-statistics-2026), secondary). US estimates disagree ($15.8B vs $23.4B).
- **Affiliates are the engine:** creator affiliates drive about 42% of US GMV (secondary). Open-collaboration commissions run about 10–15%, targeted deals 18–25%+, and averages about 13% ([z.media](https://www.z.media/insights/tiktok-shop-affiliate-commissions-tier-model-2026), [medialabs](https://medialabs-co.com/tiktok-shop-fees), secondary).
- **Platform fees:** a 6% referral fee in most US categories, plus optional programme fees (secondary).
- **Ranking signals:** interactions (watch-through, replays, shares, follows, "not interested"), video information (captions, sounds), and device and account settings, which get lower weight ([TikTok newsroom](https://newsroom.tiktok.com/en-us/how-tiktok-recommends-videos-for-you/)).
- **Lesson:** we need an affiliate programme where any creator can link any product and earn a visible, fixed commission. We need shoppable video where the product sheet is one tap away (we have this). And the ranking model must optimise for watch time *and* purchases, not just clicks.

### Douyin (China)

- **Scale:** about RMB 3.5 trillion GMV in 2024, growing 34% year on year to mid-2025 ([KrASIA citing 36Kr](https://kr-asia.com/pulses/157556); Douyin declined to comment).
- **The pivot:** "shelf" e-commerce (search, product pages, storefronts) was 30% of GMV in 2023 and 40% in 2024, and about 50% by 2025. During 618 2025, shelf sales were about RMB 200B ([36Kr](https://eu.36kr.com/en/p/3480136952077441)). In 2024 the split was 40% shelf, 30% merchant-run live, 30% influencer live.
- **Subsidies and costs:** Douyin merged its ad unit into e-commerce and shifted about RMB 19B of subsidies to merchants to cut their costs ([KrASIA](https://amp.kr-asia.com/douyin-reshapes-strategy-to-cut-merchant-costs-as-gmv-grows)).
- **Lesson:** don't build only a feed. Search, categories, storefronts and "buy again" must be first-class from day one. **Merchant-run live (sellers streaming their own factory) matters as much as influencers.** Our factory tours already point this way.

### Xiaohongshu / RedNote

- **Model:** "seeding" (种草): detailed, first-person notes that read like a friend's recommendation, which make RedNote a decision gateway for young consumers ([First Page](https://www.firstpage.hk/resources/uncategorized/2025-xiaohongshu-rednote-marketing-guide-the-strategies-behind-brand-success/), [WalkTheChat](https://walkthechat.com/3-trends-of-rednote-marketing-in-2024/)).
- **Buyer-led live:** curators ("buyers") such as Dong Jie took about RMB 43–78M GMV per stream in 2023–24 (secondary). Over 400M MAU since 2025 (secondary).
- **Lesson:** our Discover notes are this. Make notes searchable, linkable to products, and the source of reviews and Q&A.

### Whatnot (live auctions)

- **Scale:** GMV of over $6–8B in 2025, doubling year on year. Company estimates give it about 60% of North American and European live shopping. Valued at $11.5B ([Retail TouchPoints](https://www.retailtouchpoints.com/?p=618952), [Net Influencer](https://www.netinfluencer.com/whatnot-raises-225-million-as-investors-bet-on-live-shopping/), company figures).
- **Lesson:** live auctions and collectibles build habit (a scheduled show is an appointment). Low latency is essential when bids land in seconds: one live-shopping app moved from 8 s RTMP to under 300 ms WebRTC ([AWS: Voggt](https://aws.amazon.com/blogs/media/live-shopping-platform-voggt-reduces-live-stream-latency-with-amazon-ivs)).

### Meta (Instagram) and YouTube

- **Instagram Explore:**
  - Retrieval mixes collaborative filtering, personalised PageRank and two-tower models, pulling up to about 1,500 candidates.
  - A first-stage two-tower model cuts them to about 100.
  - A second-stage multi-task model ranks them.
  - Final rules handle safety and diversity ([Meta transparency](https://transparency.meta.com/features/explaining-ranking/ig-explore/), [Meta engineering](https://engineering.fb.com/2023/08/09/ml-applications/scaling-instagram-explore-recommendations-system/)).
- **Lesson:** this staged funnel is the standard shape of every large feed. See [03](03-feed-video-live.md).

## Shelf marketplaces

### Amazon

- **Third parties:** third-party sellers made 60% of paid units in Q1 2026 ([Canopy](https://canopymanagement.com/amazon-q1-2026-earnings-seller-implications/), secondary).
- **Ads are the profit engine:** ad revenue was $17.2B in Q1 2026, up 24% (secondary).
- **AI shopping:** Amazon says its Rufus assistant drove about $12B of incremental annualised sales in 2025, with 300M+ users ([PPC Land](https://ppc.land/amazons-ai-shopping-assistant-drove-12-billion-in-sales-for-2025/), company measurement). One secondary source says Rufus was folded into Alexa for Shopping in May 2026, which is unverified.
- **Lesson:**
  - Sponsored listings in search and the feed should arrive early, clearly labelled.
  - A shopping agent (our "Ask") is now table stakes.
  - Third-party sellers plus our fulfilment and consolidation is the right model, versus owning inventory.

### Walmart

- **Growth:** US marketplace growth of about 20% in Q4 FY26, and reportedly 50% in Q1 FY27. Global advertising grew 37% in Q1 FY27, and advertising plus membership is about a third of operating income ([Digital Commerce 360](https://www.digitalcommerce360.com/2026/02/23/walmart-online-sales-ecommerce-ai-q4-fy26/), [Stellagent](https://stellagent.ai/insights/walmart-q1-fy2027-ecommerce-advertising), secondary).
- **AI agent:** Sparky users spend about 35–40% more per order (secondary).
- **Engineering:** a hybrid cloud (own data centres, Azure and Google; not AWS) with one internal platform over all of it ([InfoWorld](https://www.infoworld.com/article/3666468/how-walmart-abstracts-its-hybrid-cloud-for-developers.html)).
- **Lesson:**
  - Membership plus ads plus marketplace is a stronger business than retail margin.
  - A platform layer that hides which cloud you're on keeps you free to move.

### Temu / Pinduoduo

- **Model:** in the US, Temu moved from "fully managed" (Temu sets prices and ships from China) to "semi-managed" (sellers hold local stock). By Q2 2025 about 70% of US GMV was semi-managed. Under semi-managed, tariffs apply to the merchant's cost rather than the retail price, cutting the tariff's effect on final prices from about 54% to 13–18% (UBS via [Tech Buzz China](https://techbuzzchina.substack.com/i/170579358/changes-to-the-operational-models)).
- **Shock test:** around the May 2025 US de minimis change, Temu paused direct-from-China shipping entirely ([Tech Buzz China](https://techbuzzchina.substack.com/p/temu-watch-8-how-temu-responded-to)).
- **Lesson:** **cross-border-only is fragile.** We need both direct-from-China shipping and local-warehouse ("ships from Lagos in 2 days") listings, so the business survives a duty change. Our catalog already has `shipsFrom`; logistics must use it.

### Shein

- **Model:** test-and-reorder. New styles launch in batches of 100–200 units, and engagement, sales speed and social mentions decide what gets reordered. Cycles can be as short as about 10 days ([Monetate](https://monetate.com/resource/5-ways-shein-ecommerce-is-leading-the-evolution-of-fast-fashion/), [Sacra](https://sacra.com/chat/h/901005a4-6e3f-49ac-8192-95e6a1e3584f/); company-sourced). Shein claims single-digit unsold inventory.
- **Lesson:** our sellers are factories. Give them demand signals (saves, watches, price alerts, poll votes) so they can make to order. That's a seller-tools feature with real value, and our engagement data already captures it.

### Shopee (Southeast Asia)

- **Take rate:** about 13.0% in 2025 (12.4% in 2024), driven by ads, with ad revenue up 80%+ year on year in Q4 2025 ([Bisnis](https://teknologi.bisnis.com/read/20260311/84/1959296/shopee-catat-pertumbuhan-sepanjang-2025-transaksi-bruto-tembus-rp2150-triliun), secondary).
- **Video:** over 20% of physical-goods orders came from livestreams and short videos in Q2 2025 ([earnings call](https://www.marketbeat.com/earnings/reports/2025-8-12-sea-limited-stock)).
- **Lesson:** a marketplace in an emerging market can add video and live and get a fifth of orders from them within about two years.

### Meesho (India)

- **Model:** no seller commission; revenue comes from logistics markup and ads. Its own logistics network (Valmo) carries about 65% of orders, bringing logistics cost to about ₹45 per order. Average order value fell to about ₹274 while orders rose to 1.83B ([Zerodha Daily Brief](https://thedailybrief.zerodha.com/p/inside-meeshos-ipo), [HDFC IPO note](https://www.hdfcsec.com/hsl.docs/Meesho%20Ltd%20IPO%20Note-202512021622101142058.pdf), secondary).
- **Cloud:** Meesho is spending about ₹1,390 crore to cut reliance on external cloud vendors.
- **Lesson:** in price-sensitive markets, **cost per order is the business.** Server cost, support cost and logistics cost per order must be tracked from launch (see [05](05-infrastructure-free-to-faang.md)).

### Mercado Libre (Latin America)

- **Results:** 2025 revenue grew 39%. About 75% of shipments arrive within 48 hours. Its first fulfilment centre in China opened in December 2025 ([Business Wire](https://www.businesswire.com/news/home/20260224265595/en/Mercado-Libre-Caps-Stellar-2025-Performance-with-45-YoY-Revenue-Growth-in-Q4-as-Strategic-Investments-Accelerate-Market-Share-Gains), [Mexico Business](https://mexicobusiness.news/ecommerce/news/mercado-libre-delivers-record-2025-sales-45-4q25-growth)).
- **Fintech flywheel:** marketplace data feeds credit underwriting; nearly 3M credit cards were issued in Q4 2025, and the credit book grew 90%.
- **Lesson:** in emerging markets, **owning payments and logistics is the moat.** Our stablecoin ledger and escrow are the seed of the same flywheel (escrow, then seller balances, then seller financing).

### Jumia (Africa)

- **Focus:** narrowed to Nigeria, Kenya, Egypt and Uganda, putting profit before scale. Q2 2025 revenue rose 25% and Nigeria's GMV 36%. Items sold by international sellers rose 36%, helped by an office in Yiwu ([Jumia Q2 2025](https://www.newswire.com/news/jumia-reports-second-quarter-2025-results), [TechCabal](https://techcabal.com/2025/08/07/jumia-narrows-losses-as-q2-2025-revenue-surges-by-25-to-45-6-million/)).
- **Lesson:** our thesis of Chinese factories selling to Africa is validated, and so is focus. Launch in a few countries with real logistics partners.

## What this means for the product

| Learned from | Build |
|---|---|
| Douyin, Amazon | Feed **and** shelf: search, categories, storefronts and reorder are first-class |
| TikTok Shop | Creator affiliate programme with fixed, visible commissions, and creator storefronts |
| Whatnot, Douyin | Seller-run live and auctions with sub-second latency |
| Amazon, Walmart, Shopee | Sponsored listings (clearly labelled) as the main monetisation after commission |
| Amazon Rufus, Walmart Sparky | A shopping agent that can act (search, compare, add to bag), with approvals |
| Temu | Cross-border plus local-warehouse listings; never depend on one customs regime |
| Shein | Demand signals for factories: saves, watches, polls, made-to-order |
| Meesho | Cost per order as a top-level metric; cheap logistics as a product |
| Mercado Libre | Payments and escrow, then seller balances, then financing |
| Jumia | Launch focused, expand by country with partners |
| RedNote | Notes and reviews as searchable, shoppable content |
