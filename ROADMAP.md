# Roadmap

We are in the **design phase**: every feature below is built as real UI running on fixture data (`src/fixtures`). Accounts, payments, search infrastructure and the database come in the functionality phase, after we agree the tech stack.

Status: ✅ built on fixtures · 🚧 in progress · ⬜ planned

**Phase 1 is complete:** all 43 design items below are built on fixtures (24 Oct 2026). Next step: agree the tech stack, then start Phase 2.

## Built so far

- For You feed: the video gets the whole screen, with a product peek docked beside a minimized tab bar.
- Shop sheet with Shop / Social / Details / More tabs (phone sheet, desktop side panel).
- Product page, checkout with duties-paid pricing and hold-to-pay.
- Live room with flash deal, live auction with hold-to-bid.
- Drops (night deals, team buys), Discover (notes waterfall), Me (orders, saved, Liquid Glass strength).

## What the research says (October 2026)

- **iOS 27's headline design change is a Liquid Glass opacity slider**, plus better readability over busy content. We already ship the slider (Me → Liquid Glass), so the design system is on the current iOS track. ([BGR](https://www.bgr.com/2191219/ios-27-liquid-glass-fix-customization/), [TapSmart](https://www.tapsmart.com/features/wwdc26-8-things-we-learned/))
- **Shopping is moving into AI agents.** Amazon folded Rufus into Alexa for Shopping, with *Auto Buy* at a target price and *Buy for Me*. Douyin's Doubao tests "one-command shopping". Alibaba's Accio drafts supplier shortlists and bulk quote requests, with a human approving terms. ([Stellagent](https://stellagent.ai/insights/amazon-rufus-buy-for-me-alexa-plus), [Modern Retail](https://www.modernretail.co/?p=143537), [36Kr](https://eu.36kr.com/en/p/4002454472282248), [Digital Commerce 360](https://www.digitalcommerce360.com/2026/07/24/alibaba-accio-work-agentic-ai-b2b-sourcing/))
- **Gen Z discovers in feeds and buys through social apps.** Over 70% research products on social media. Many have bought directly in a social app (sources range from 44% to 72%). 82% plan to buy dupes, but quality beats discounts for about half. ([eMarketer](https://www.emarketer.com/content/generational-shopping-trends-2026), [Ringly](https://www.ringly.io/blog/gen-z-shopping-statistics-2026))
- **Sharing works best when it's part of the purchase.** Pinduoduo's team price only unlocks when a team fills. It drew a lawsuit when the share target kept moving, so we keep targets fixed and visible. ([Outside-In Lens](https://outsideinlens.substack.com/p/pursuing-interactive-commerce-the-a23), [Global Sources](https://www.globalsources.com/knowledge/pinduoduo-vs-temu/))
- **Games keep people coming back.** Temu uses coins and spins; Shein's loyalty game shows lower churn. ([Sensor Tower](https://sensortower.com/blog/e-commerce-app-battle-temus-rising-star-challenged-by-sheins-loyalty-game), [Bloomberg](https://www.bloomberg.com/professional/insights/markets/online-retails-killer-apps-might-be-made-in-china))
- **Live shopping formats:** Whatnot's include auctions, buy-it-now, flash sales, giveaways, pre-bids, offers, polls and pinned items. ([Whatnot overview](https://racklify.com/encyclopedia/what-are-whatnot-livestream-tools-features-and-how-they-work/))
- **Cross-border is the real moat.** RedNote's overseas shop ships direct with AI translation. In our first markets, mobile money (M-Pesa, MTN MoMo, Airtel, Orange) and clear duties decide the sale. ([36Kr](https://eu.36kr.com/en/p/3818580792050565), [Kolonell](https://kolonell.com/en/blog/cross-border-mobile-money-diaspora-payments-2026))
- **Image search and try-on are table stakes** for marketplaces (AliExpress Image Search; AR placement for furniture and try-on for fashion). ([AliExpress listing](https://apple.co/2SNDISa), [Fittingbox](https://fittingbox.com/en/resources/blog/best-virtual-try-on-apps-for-your-shopify-store))

## Phase 1: design on fixtures

### A. Global and trust (our moat)

- ✅ **A1 Ship-to and local currency.** Pick a country once; every price shows in local currency, and delivery and duties follow the country.
- ✅ **A2 Landed price.** A "duties included" price with a breakdown (item, shipping, duties, fees).
- ✅ **A3 Seller storefronts with factory verification.** `/s/[id]`: cover, follow, products, videos, reviews, plus a factory tab with audit date, certificates, capacity and response time.
- ✅ **A4 Order journey.** `/orders/[id]`: factory → port → ship or air → customs → local hub → door, with ETA and a live progress strip.
- ✅ **A5 Buyer protection and returns.** A protection timeline and "report a problem" flow on every order.
- ✅ **A6 Auto-translate.** "Translated from Chinese · Show original" on seller messages and comments.

### B. Discovery

- ✅ **B1 Search results with filters.** `/search`: Products, Videos, Factories and Live tabs. Filters for price, delivery speed, verified factory, rating and minimum order; sort options.
- ✅ **B2 Snap to search.** Camera or upload, scanning animation, matches with similarity scores.
- ✅ **B3 Voice search.** Mic with a listening state.
- ✅ **B4 Category mall.** `/c` for every category, `/c/[id]` landing pages with subcategories, top factories, best sellers and live rooms.
- ✅ **B5 Rankings.** `/rankings`: Best sellers, Most saved, Top rated and Rising factories, by day/week/month and category, with podium and movement arrows. Linked from Discover.
- ✅ **B6 Shop the look.** Tagged videos show product pins on the frame; the peek says "Shop the look · 3 items"; the Shop tab switches between items and adds the whole look.
- ✅ **B8 Factory towns.** Shop by China's manufacturing clusters (Shenzhen electronics, Yiwu small goods, Baigou bags, Jingdezhen porcelain), with the export port each ships through. Cards, not a map, to stay clear of border disputes.
- ✅ **B7 Feed controls.** "Why you're seeing this", more/less like this, mute a seller, and topic tuning. Only videos you haven't reached reorder.

### C. AI

- ✅ **C1 Ask, the shopping agent.** `/ask`: compares products, explains duties, builds a bag, sets price watches, and drafts factory quote requests. You approve every purchase.
- ✅ **C2 Price watch and auto-buy.** Set a target price; see a 90-day price history.
- ✅ **C3 Review intelligence.** Aspect scores (quality, shipping, value, as described) and a photo-review filter.

### D. Social

- ✅ **D1 Inbox.** `/inbox`: chats with sellers (product cards, quick replies, translation) and activity (price drops, lives starting, replies, order updates).
- ✅ **D2 Reviews and Q&A with photos** on the product page.
- ✅ **D3 Share sheet and product poster.** WhatsApp, Instagram, TikTok, X and copy link, with a generated product card.
- ✅ **D4 Collections.** Shareable boards ("Van build", "Dorm setup").
- ✅ **D5 Ask friends.** `/poll/[id]`: "This or that?" polls with one-tap votes, live percentages, voter faces and reasons. Start one from Compare or the share sheet.
- ✅ **D6 Creator hub.** Earn commission on what you post: links, earnings, sample requests.

### E. Commerce and play

- ✅ **E1 Bag 2.0.** Grouped by shipping origin, consolidated-shipping savings, free-shipping progress, save for later, coupons.
- ✅ **E2 Solar kit builder and savings calculator.** `/energy`: sized from your bill and your country's sun hours, with backup hours, a wind option, editable quantities, delivered price, payback and CO₂. Linked from the energy category and Ask.
- ✅ **E3 Compare.** `/compare`: up to three products, the winner of each row marked, an overall pick, "only differences", and shareable `?ids=` links. Compare button on product pages; Ask comparisons open it.
- ✅ **E4 Rewards.** `/rewards`: coins, daily streak, missions, levels and badges.
- ✅ **E5 Coupon wallet.** Claimable store and product coupons, and a wallet in Me.
- ✅ **E6 Price chop with friends.** `/chop/[id]`: a fixed target, a fixed number of equal cuts and a clock that never resets, with the rules printed under the button. Listed on Drops.
- ✅ **E7 Drops calendar and pre-orders.** An 11.11 countdown, a 14-day strip and drop cards in the shopper's own time zone, with reminders, pre-order reservations and 11.11 deposits that count 3×.
- ✅ **E8 Blind-box reveal.** `/unbox`: pick a sealed box from a real case, shake it for "not this one" hints, open it with a reveal animation, collect a shelf, see published odds, or buy the whole case.
- ✅ **E9 Gifting.** "Send it as a gift" on product pages: the recipient's country, a card design and note, hidden price, "let them choose the size" and duties prepaid. `/gift` is what the recipient unwraps.
- ✅ **E10 Wholesale mode.** Business toggle: tier pricing, quote requests (RFQ), samples, trade assurance.

### F. Live

- ✅ **F1 Live lobby and schedule.** `/live`: a featured room, rooms on now (shows, factory tours, the auction), upcoming shows in local time with reminders, and shoppable replays. Rooms live at `/live/[id]`.
- ✅ **F2 Live room upgrades.** "Just bought" toasts, a host-pinned Q&A, a product carousel with the on-air flash deal first, and "Ask to see" for items coming up.

### G. Experience and design system

- ✅ **G1 Real video.** Muted, looping Mixkit clips (free licence) on four feed videos: tap to pause, a scrubber with times while paused, and a sound toggle that sticks across clips.
- ✅ **G2 Motion and feedback.** Photos arc into the bag button on every add, confetti when an order is placed, and haptics on add, like and order. Reduced motion is respected.
- ✅ **G3 Live Activity banner.** A Dynamic-Island-style pill for an active order or auction.
- ✅ **G4 Onboarding.** `/welcome`: a product marquee, ship-to country, interests that tune the feed, notification choices, account options, and a welcome coupon with confetti.
- ✅ **G5 Command palette.** ⌘K, Ctrl+K or "/": pages, products, sellers, categories, "Ship to…" and Liquid Glass levels, plus "Ask Yuan" for anything typed.
- ✅ **G6 Installable app (PWA).** A web manifest with shortcuts, generated icons, a production-only service worker with an `/offline` page, an offline banner (`experimental.useOffline`), and an install card in Me.
- ✅ **G7 Empty states and 404.** A shared empty-state component, a "lost in customs" 404 with trending searches, and an empty bag that suggests what's selling.

### H. Foundation

- ✅ **H1 Fixture data layer.** Fixtures live in `src/fixtures`, and queries in `src/lib/catalog.ts` are the only way pages read them, so the database can replace fixtures without touching UI. Expanded catalog: 40+ products across 12 categories.

## Phase 2: functionality

Stack (decided 24 Oct 2026): Next.js 16 modular monolith with clean architecture and DDD, PostgreSQL with Drizzle ORM, Zod at the edges, Vitest, and stablecoin payments worldwide. Details and rules are in ARCHITECTURE.md.

- ✅ **Foundation.** Bounded contexts under `src/modules`, a shared kernel (Result, Money in cents, UUIDv7, Clock), validated env, brand from `.env` (Lychee), lint-enforced layer boundaries, migrations, zero-setup embedded Postgres for development, CI-ready `pnpm check`.
- ✅ **Markets, all countries.** 249 countries from open datasets with currency, time zone, VAT/GST where known, and an exchange-rate snapshot; ship-to works everywhere.
- ✅ **Catalog on Postgres.** Categories, sellers with storefronts, products with tiers and options; product, category, storefront, feed, Discover and categories pages read the database, cached with tags.
- ✅ **Search.** Postgres full-text with stemming, synonyms and search-as-you-type; price, category, rating, sale, bulk, delivery and verified filters; `GET /api/search`.
- ✅ **Checkout and orders.** Server-side repricing (the browser's prices are never trusted), coupons, parcels, duties now or at the door; order and invoice saved in one transaction; order tracking reads the database.
- ✅ **Stablecoin payments.** USDC on Base and Solana and USDT on Tron at checkout; invoices with unique amounts, QR and wallet links, live confirmation, expiry; double-entry ledger with Protect escrow. Simulated in development; on-chain verification for USDC on Base.
- ✅ **Accounts.** Passwordless sign-in by 6-digit email code (hashed, single-use, 5 tries, rate-limited) or by wallet signature (Sign-In with Ethereum); revocable 30-day sessions; checkout requires sign-in; orders, invoices and payments are visible only to their buyer; Me shows real orders.
- ✅ **Account data off the device.** Signed in, the bag, saved items, price alerts, watches, coupon wallet, coins and check-in streak live on the account; the browser keeps a mirror that works offline. At sign-in the device's bag and lists merge into the account (no doubled quantities); signing out clears them from the device. Coupons are claimed into a wallet, reserved by checkout, spent on payment and returned if the order lapses unpaid. Coins are server-only: daily check-ins pay once a day, rewards spend coins and claim the coupon in one transaction, and the balance can't go below zero.
- ✅ **Speed.** Measured on a mid-range phone on 4G (cold cache): first paint 0.33–0.76 s and largest paint 0.33–1.08 s on every main page, down from 0.5–5 s and 0.5–13 s; tab-to-tab navigation 0.1–0.5 s. Photos served from our own origin through a cached `/img` route, sized per screen; CSS inlined; sheets, the shop panel and the command palette load on demand; no zod in the browser. See ARCHITECTURE.md decision 13.
- ✅ **On-chain verification for Solana and Tron.** USDC on Solana is confirmed from the treasury's token balances in finalized transactions (each transaction read once, then remembered), with a Solana Pay link; USDT on Tron from TronGrid's confirmed TRC-20 transfers. Like Base, each invoice is matched by its unique amount. Every rail with a treasury address is offered at checkout; test networks (Solana devnet, Tron Nile) by default.
- ✅ **Fulfilment and Protect.** A paid order opens one parcel per shop. The shop adds the carrier and tracking number; the buyer confirms it arrived (or it confirms itself 21 days after shipping), which releases that shop's lines from escrow less the platform commission (`PLATFORM_COMMISSION`, 6% by default). Before confirming, the buyer can open a case; a moderator refunds the buyer or pays the shop, with a note both see. When every parcel is settled the order completes and the rest of its escrow (shipping, duty, VAT, less the coupon) is booked to logistics. Every step is a ledger journal keyed to its cause, so a replayed event never moves money twice.
- ✅ **Payouts and refunds.** Shops see what's available and what Protect still holds, and withdraw from $20 to the USDC wallet they applied with. Payouts and refunds queue for an admin, who sends USDC on Base from the treasury wallet and records the transaction (each hash once); a payout can be cancelled back to the balance. No private key lives on the server.
- ✅ **Notifications.** In-app (`/notifications`, a badge on Me) and email (Resend) for new orders, shipping, delivery and release, disputes, refunds, payouts, answers, reviews, shop approval and live videos; one per person per event even when events are delivered twice.
- ✅ **Verified reviews.** Buyers review products from delivered parcels, once per product per order; each review updates the product's rating exactly once.
- ⬜ **Automated payouts** through a custody API (Circle, Fireblocks) once volume justifies it; off-ramp for mainland-China sellers; shipping-deadline enforcement (auto-cancel and refund parcels never shipped).
- ✅ **Content on Postgres.** Videos (with renditions and hot counters kept apart), notes, comments, reviews and Q&A come from the database. The feed is a ranked order (engagement per view, smoothed, with a freshness curve and regular slots for new uploads) cut into pages: the first few slides render with the page, the rest load as you swipe (`GET /api/feed`); Following is newest-first from followed shops; shared links open the feed on that video. Likes, comment likes, note likes and "useful" votes are one per person, kept with their counters in one transaction; comments and questions go through rate limits and record events in the outbox; questions show once answered. Watching is reported by beacon (`POST /api/events`), summed in memory and written in batches to lifetime counters and a per-day table.
- ✅ **Uploads.** Creators post videos from the creator hub (`/creator/new`): the browser uploads straight to storage with a signed ticket that fixes the type and exact size (Cloudflare R2 in production, the server's disk in development); the video joins an encoding queue kept on its own row (leased, retried, never blocking other background work); ffmpeg makes 720p and 480p H.264 MP4s with the index up front, a poster and a bright/dark reading; then it goes live (or waits for a moderator where uploads are pre-moderated) and the feed, shop and category pages refresh. "Your videos" shows each one preparing, in review or live, with views and likes. Shared links (`/?v=`) open the feed on that video.
- ✅ **Selling.** Anyone signed in can apply to sell (`/sell`): business details, a shop address, a USDC payout wallet, and a business licence and owner ID uploaded to private storage that only reviewers can open, through links that expire in 10 minutes. Approval opens a verified shop owned by the applicant in one transaction; rejection sends the reason back and the applicant can fix and resubmit. Shops manage listings (photos uploaded and resized on demand, price, volume tiers, options, highlights, specs, delivery time; draft, live, archived), answer buyers' questions, see their paid orders, and edit their storefront. Changes show on the seller's own pages at once (`updateTag`).
- ✅ **Admin console** (`/admin`, for `ADMIN_EMAILS`): seller applications, uploads held for review (approve or remove), and reports. People report videos, comments, questions and reviews (one open report per person per item); a takedown removes the item, fixes its counters, closes its reports and refreshes every page that showed it.
- ⬜ **Automatic identity checks** (Smile ID or Persona) as a first pass before human review; seller staff accounts; listing stock levels.
- ✅ **Search for videos, shops and live rooms on the server.** `GET /api/search/all` returns, for one query, the videos whose caption or place match (Postgres full-text, a GIN-indexed column) or that show a matching product; the shops named like it or selling what matched, most matching listings first, with photos of them; and the live and upcoming shows about it or selling it. Cached a few minutes per query, like product search. The search screen and the ⌘K palette use it, so new shops and uploads are findable at once.
- ✅ **Creator affiliate programme.** Every account has a creator code; any link with `?ref=<code>` (copied from the share sheet or the creator hub) credits the creator for 7 days, last link wins, through an http-only cookie set by `POST /api/ref`, which also counts the click. Shopping from a video someone posted credits them too. The order keeps the code; when it's paid, each shop in it owes the creator its programme rate (default 10%, chosen by the shop from Off to 25%) of its lines, never for the creator's own purchases or a shop they work for. Delivery pays the creator out of the shop's share in the same ledger journal that releases it; a refund voids it. The creator hub shows clicks, orders, conversion, weekly earnings, each link's results and products worth promoting with what they'd earn; creators withdraw from $20 to a USDC wallet on Base through the admin's send-money queue, and hear when they earn and when it's sent.
- ✅ **Sponsored listings.** Shops promote their live listings from `/sell/ads` with a price per tap ($0.05–$5) and a daily budget, paid from their earnings balance. Sponsored cards, marked "Sponsored", take the first slot and the fifth in searches they match (and on their category page), never repeating an organic result. Each slot is a second-price auction weighted by how often an ad gets tapped, one ad per shop, so relevant ads beat merely rich ones and every winner pays just enough to keep its place; budgets are paced across the day, and a shop that can't cover a tap sits out. A tap is billed once per impression through a signed, 30-minute token, as a ledger journal from the shop's balance to platform ad revenue. Shops see impressions, taps, tap rate and spend per campaign, and pause or rebid at any time.
- ⬜ **Ads, next.** Sponsored videos in the feed, keyword targeting, topping up an ad balance with stablecoins, impressions counted once per shopper rather than per search request.
- ✅ **Ask friends (polls).** "This or that?" polls are stored with a short share link (`/poll/<id>`); anyone votes with one tap, no account needed (an anonymous browser id counts once), can change their mind and say why; the asker watches votes arrive; polls close after 24 hours.
- ✅ **Price chops.** Shops offer a listing at a fixed target reached by a fixed number of equal cuts within 12, 24 or 48 hours, with a set stock (`/sell/ads` → Chop with friends). A shopper starts a chop (reserving one unit, with the first cut), friends cut with one tap, no account needed, at most 10 cuts a day per person; at the target the shopper gets the price for 48 hours, honoured at checkout for one item and used up when paid, and is notified. Chops that run out of time give their unit back.
- ✅ **Rewards on real activity.** Missions (first order, a review, saving three things, asking friends, a finished chop, an order from your link) pay coins once when claimed; badges come from what people did (solar gear bought, an auction won, three countries, five reviews, a finished chop, a first commission); levels follow coins earned over time, the same on Me and Rewards.
- ✅ **Rankings from real data.** Best sellers count units in paid orders and Most saved counts saves in the window (today, this week, this month), with movement against the window before; Top rated uses real ratings; Rising factories ranks shops by sales growth. Quiet windows are topped up with all-time leaders and say so. Paid orders also count into each listing's "sold", once per order.
- ✅ **Drops and team buys.** Shops schedule drops (a drop price with a stock and a per-person limit, or a plain restock) and team-buy offers from the Promote page. The Drops page shows what's live now with real stock bars and each deal's own end time; claiming a drop price holds it for 30 minutes (stock taken atomically, given back if not bought). Upcoming drops sit in a 14-day calendar in the shopper's time zone with real "waiting" counts; reminders (and one for 11.11) notify 10 minutes before. A team buy unlocks its team price for every member once the team is full within its time limit (`/team/<id>`); nobody pays to join, and teams that don't fill just close. Every drop, team, chop, live and auction price flows through the same checkout holds.
- ✅ **Free samples for creators.** Shops offer a number of free samples of a listing (Promote page); creators ask from the creator hub with a shipping address only that shop sees; the shop ships with tracking or declines with a reason (the sample goes back on offer). When the creator's video featuring the product goes live, the sample counts as posted; one shipped 21 days ago without a video lapses, and creators with two lapses can't ask for more. Everyone is notified at each step.
- ⬜ **Engagement, next.** Pre-orders and 11.11 deposits (part payments), collections on the account.
- ✅ **Live shopping.** Shops plan shows (`/sell/live`: title, kind, up to 30 products, each with an optional live price) and broadcast from the browser's camera (WHIP) or OBS to a self-hosted MediaMTX server, which buyers watch as low-latency HLS. Rooms are real-time over Server-Sent Events fed by Postgres LISTEN/NOTIFY, so every app instance sees every message: chat (rate-limited, the host's lines marked), hearts, a viewer count, the product on air and a pinned answer. "Grab" holds the live price for that buyer for 30 minutes (up to 5 units) and checkout honours it. Auctions: the host opens a lot (start price, step, 30 s to 30 min), bids are hold-to-confirm, a bid in the last 10 s extends the clock, concurrent bids are settled by version, and the winner gets the hammer price held for 48 hours plus a notification. The lobby (`/live`) lists rooms on now, upcoming shows and past shows from the database; the media server asks the app before anyone publishes (the show's stream key) or watches (only while live).
- ⬜ **Live, next.** Recordings for replays, co-hosts, a moderator role for chat, scheduled reminders that notify followers, seller analytics.
- ⬜ **Shopping agent with tools and approvals.**
- ✅ **Production foundation.** Outbox for domain events and a background-job runner (invoice sweep, daily exchange rates, pruning); rate limits on sign-in, checkout, account writes and search; `/api/health`; structured logs and server-error reporting; Docker image with bundled migrate/seed/worker; one-server deployment on Oracle Always Free behind a Cloudflare Tunnel, nightly backups to R2, CI and an SSH deploy workflow ([deploy/README.md](deploy/README.md)).
- ⬜ **Operations, stage 1.** Shared cache handler for several app instances, continuous WAL backups, metrics and traces (OpenTelemetry → Grafana Cloud), alerting.

## Guardrails

- No dark patterns: share targets and timers are fixed and visible, and a countdown never resets mid-deal.
- "Factory alternatives", never counterfeits. No product may copy a brand's trademark.
- Replace sample Unsplash photos before launch; some show third-party brands.
- Every AI action that spends money needs the user's explicit approval.
