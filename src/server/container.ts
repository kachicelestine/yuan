import "server-only";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { brand } from "@/config/brand";
import { serverEnv } from "@/config/server-env";
import { makeCatalogAdmin, makeCatalogQueries, makeRatings, makeSearchProducts, makeSearchShops, makeSelling, type SellerId } from "@/modules/catalog";
import { DrizzleCategoryRepository, DrizzleProductRepository, DrizzleSellerRepository } from "@/modules/catalog/infrastructure/drizzle-catalog-repositories";
import { DrizzleProductSearch } from "@/modules/catalog/infrastructure/drizzle-product-search";
import { makeContentQueries, makeInteractions, makeModeration, makeUploads, type VideoEncoder } from "@/modules/content";
import { CopyEncoder } from "@/modules/content/infrastructure/copy-encoder";
import {
  DrizzleCommentRepository,
  DrizzleLikeRepository,
  DrizzleNoteRepository,
  DrizzleQuestionRepository,
  DrizzleReportRepository,
  DrizzleReviewRepository,
  DrizzleVideoRepository,
} from "@/modules/content/infrastructure/drizzle-content-repositories";
import { FfmpegEncoder } from "@/modules/content/infrastructure/ffmpeg-encoder";
import { makeBlindBoxes, makeBoards, makeCouponDesk, makeDeposits, makeChops, makeEngagement, makePolls, makePromos, makeRewards, pollId } from "@/modules/engagement";
import { DrizzleBoardRepository } from "@/modules/engagement/infrastructure/drizzle-board-repository";
import { DrizzleBlindBoxRepository } from "@/modules/engagement/infrastructure/drizzle-blindbox-repository";
import { DrizzleDepositRepository } from "@/modules/engagement/infrastructure/drizzle-deposit-repository";
import { DrizzleDropRepository, DrizzlePromoHoldRepository, DrizzleReminderRepository, DrizzleTeamRepository } from "@/modules/engagement/infrastructure/drizzle-promo-repositories";
import { DrizzleChopRepository } from "@/modules/engagement/infrastructure/drizzle-chop-repository";
import { DrizzlePollRepository } from "@/modules/engagement/infrastructure/drizzle-poll-repository";
import {
  DrizzleClaimRepository,
  DrizzleCoinRepository,
  DrizzleCouponRepository,
  DrizzleListRepository,
  DrizzleRewardRepository,
  DrizzleWatchRepository,
} from "@/modules/engagement/infrastructure/drizzle-engagement-repositories";
import { makeIdentity } from "@/modules/identity";
import { ConsoleMailer, NodeSecrets, ResendMailer, ViemVerifier } from "@/modules/identity/infrastructure/adapters";
import { DrizzleAccountRepository, DrizzleChallengeRepository, DrizzleSessionRepository } from "@/modules/identity/infrastructure/drizzle-identity-repositories";
import { makeLive, type LiveBus } from "@/modules/live";
import { DrizzleChatRepository, DrizzleHoldRepository, DrizzleLotRepository, DrizzleShowRepository } from "@/modules/live/infrastructure/drizzle-live-repositories";
import { PostgresBus } from "@/modules/live/infrastructure/postgres-bus";
import { makeListMarkets, makeRefreshRates } from "@/modules/markets";
import { makeOnboarding } from "@/modules/merchants";
import { DrizzleApplicationRepository, DrizzleMembershipRepository } from "@/modules/merchants/infrastructure/drizzle-merchants-repositories";
import { DrizzleCountryRepository, DrizzleFxRateRepository } from "@/modules/markets/infrastructure/drizzle-markets-repository";
import { OpenErApiRateSource } from "@/modules/markets/infrastructure/open-er-api-rate-source";
import { makeCancelUnpaidOrder, makeCart, makeCheckout, makeCloseDeposit, makeDepositCheckout, makeFulfilment, makeGetOrder, makeGifts, makeMarkOrderPaid, makeSellerOrders, orderNumber } from "@/modules/ordering";
import { DrizzleGiftRepository } from "@/modules/ordering/infrastructure/drizzle-gift-repository";
import { DrizzleCartRepository } from "@/modules/ordering/infrastructure/drizzle-cart-repository";
import { DrizzleOrderRepository } from "@/modules/ordering/infrastructure/drizzle-order-repository";
import { DrizzleShipmentRepository } from "@/modules/ordering/infrastructure/drizzle-shipment-repository";
import { makeCheckInvoice, makeEscrow, makeRequestPayment, makeSyncInvoices, type PaymentNetwork, type RailId } from "@/modules/payments";
import { BaseUsdcNetwork } from "@/modules/payments/infrastructure/base-usdc-network";
import { DrizzleDisbursementRepository, DrizzleInvoiceRepository, DrizzleLedger } from "@/modules/payments/infrastructure/drizzle-payments-repositories";
import { makeNotifications } from "@/modules/notifications";
import { DrizzleNotificationRepository } from "@/modules/notifications/infrastructure/drizzle-notifications-repository";
import { ConsoleEmail, ResendEmail } from "@/modules/notifications/infrastructure/email";
import { RailRouter, SimulatedNetwork } from "@/modules/payments/infrastructure/networks";
import { SolanaUsdcNetwork } from "@/modules/payments/infrastructure/solana-usdc-network";
import { TronUsdtNetwork } from "@/modules/payments/infrastructure/tron-usdt-network";
import type { Database } from "@/shared/infrastructure/database";
import { OutboxDispatcher, OutboxEventLog } from "@/shared/infrastructure/outbox";
import { PostgresRateLimiter } from "@/shared/infrastructure/rate-limit";
import { LocalStorage } from "@/shared/infrastructure/storage/local-storage";
import { R2Storage } from "@/shared/infrastructure/storage/r2-storage";
import { unitOfWork } from "@/shared/infrastructure/unit-of-work";
import { newId, systemClock, type Clock, type ObjectStorage } from "@/shared/kernel";
import { CatalogProductDirectory } from "./adapters/content-products";
import { WalletCoupons } from "./adapters/coupons";
import { IdentityEmails, MerchantWallets, OrderingPurchases, OrderingReferrals, OrderingTotals } from "./adapters/fulfilment";
import { makeAffiliates, makeSamples } from "@/modules/affiliates";
import { makeMessaging } from "@/modules/messaging";
import { makeSourcing } from "@/modules/sourcing";
import { DrizzleQuoteRepository, DrizzleRfqRepository } from "@/modules/sourcing/infrastructure/drizzle-sourcing-repositories";
import type { PriceHolds } from "@/modules/ordering";
import { DrizzleConversationRepository, DrizzleMessageRepository } from "@/modules/messaging/infrastructure/drizzle-messaging-repositories";
import { DrizzleSampleRepository } from "@/modules/affiliates/infrastructure/drizzle-sample-repository";
import { makeAds } from "@/modules/ads";
import { DrizzleAdStatsRepository, DrizzleCampaignRepository } from "@/modules/ads/infrastructure/drizzle-ads-repositories";
import { CatalogAdProducts, EscrowAdBilling, HmacSigner } from "./adapters/ads";
import { affiliatesRepos, DrizzleCommissionRepository } from "@/modules/affiliates/infrastructure/drizzle-affiliates-repositories";
import { AppActivity } from "./adapters/activity";
import { CatalogForLive } from "./adapters/live";
import { CatalogShops } from "./adapters/shops";
import { MarketDestinations } from "./adapters/destinations";
import { CatalogPricing } from "./adapters/order-catalog";
import { getDb } from "./db";

/** A random invoice tag, 1–9,999 token base units (under one cent). */
const randomTag = () => 1 + (crypto.getRandomValues(new Uint32Array(1))[0] % 9_999);
const random = () => crypto.getRandomValues(new Uint32Array(1))[0] / 2 ** 32;

/** Development falls back to a fixed secret; real deployments must set AUTH_SECRET (env validation enforces it). */
function authSecret() {
  if (serverEnv.AUTH_SECRET) return serverEnv.AUTH_SECRET;
  console.warn("[auth] AUTH_SECRET is not set; using a development secret.");
  return "development-only-secret-do-not-use-in-production";
}

type Payments = { network: PaymentNetwork; simulator: SimulatedNetwork | null };

/** Simulated in development; real chains when PAYMENTS_MODE=onchain. */
function paymentNetwork(db: Database): Payments {
  if (serverEnv.PAYMENTS_MODE === "simulated") {
    const simulator = new SimulatedNetwork(db);
    return { network: simulator, simulator };
  }
  // Each rail with a treasury address is offered at checkout (the env check requires one).
  const e = serverEnv;
  const byRail: Partial<Record<RailId, PaymentNetwork>> = {};
  if (e.PAYMENTS_BASE_ADDRESS) byRail["usdc-base"] = new BaseUsdcNetwork({ rpcUrl: e.PAYMENTS_BASE_RPC_URL!, treasury: e.PAYMENTS_BASE_ADDRESS, chain: e.PAYMENTS_BASE_CHAIN });
  if (e.PAYMENTS_SOLANA_ADDRESS) byRail["usdc-solana"] = new SolanaUsdcNetwork({ rpcUrl: e.PAYMENTS_SOLANA_RPC_URL!, treasury: e.PAYMENTS_SOLANA_ADDRESS, cluster: e.PAYMENTS_SOLANA_CLUSTER });
  if (e.PAYMENTS_TRON_ADDRESS) byRail["usdt-tron"] = new TronUsdtNetwork({ treasury: e.PAYMENTS_TRON_ADDRESS, network: e.PAYMENTS_TRON_NETWORK, apiUrl: e.PAYMENTS_TRON_API_URL, apiKey: e.PAYMENTS_TRON_API_KEY });
  return { network: new RailRouter(byRail), simulator: null };
}

type Media = { storage: ObjectStorage; privateStorage: ObjectStorage; encoder: VideoEncoder; premoderated: boolean };

let ffmpegFound: boolean | undefined;
/** Whether ffmpeg is on this machine (checked once per process). */
const hasFfmpeg = () => (ffmpegFound ??= spawnSync("ffmpeg", ["-version"], { stdio: "ignore" }).status === 0);

/** Disk in development, R2 in production; ffmpeg when it's installed. */
function media(): Media {
  const r2 = (bucket: string, publicUrl: string) =>
    new R2Storage({ accountId: serverEnv.R2_ACCOUNT_ID!, accessKeyId: serverEnv.R2_ACCESS_KEY_ID!, secretAccessKey: serverEnv.R2_SECRET_ACCESS_KEY!, bucket, publicUrl });
  const storage: ObjectStorage =
    serverEnv.STORAGE === "r2" ? r2(serverEnv.R2_BUCKET!, serverEnv.MEDIA_PUBLIC_URL!) : new LocalStorage({ dir: serverEnv.MEDIA_DIR, baseUrl: "/media", secret: authSecret() });
  // Identity documents live apart from public media, so no public route can ever serve them.
  const privateStorage: ObjectStorage =
    serverEnv.STORAGE === "r2"
      ? r2(serverEnv.R2_PRIVATE_BUCKET!, "")
      : new LocalStorage({ dir: serverEnv.PRIVATE_DIR, baseUrl: "", secret: authSecret(), uploadPath: "/api/storage/upload", downloadPath: "/api/storage/file" });
  const useFfmpeg = (serverEnv.VIDEO_ENCODER ?? (hasFfmpeg() ? "ffmpeg" : "copy")) === "ffmpeg";
  return {
    storage,
    privateStorage,
    encoder: useFfmpeg ? new FfmpegEncoder({ storage, threads: serverEnv.ENCODE_THREADS }) : new CopyEncoder(storage),
    premoderated: serverEnv.CONTENT_PREMODERATION ?? serverEnv.NODE_ENV === "production",
  };
}

// One LISTEN connection per database per process, however often wiring reruns.
const buses = new WeakMap<Database, PostgresBus>();
function liveBus(db: Database) {
  let bus = buses.get(db);
  if (!bus) buses.set(db, (bus = new PostgresBus(db)));
  return bus;
}

/** What tests swap out; production uses the defaults. */
export type WireOptions = { clock?: Clock; newTag?: () => number; payments?: Payments; media?: Media; bus?: LiveBus };

/**
 * The composition root: the one place that knows which adapter backs each port.
 * Use cases receive their dependencies here; nothing else constructs repositories.
 */
export function wire(db: Database, options: WireOptions = {}) {
  const clock = options.clock ?? systemClock;
  const newTag = options.newTag ?? randomTag;
  const countries = new DrizzleCountryRepository(db);
  const sellers = new DrizzleSellerRepository(db);
  const products = new DrizzleProductRepository(db);
  const productSearch = new DrizzleProductSearch(db);
  const pricing = new CatalogPricing(products);
  const { network, simulator } = options.payments ?? paymentNetwork(db);

  const identityRepos = (tx: Database) => ({
    accounts: new DrizzleAccountRepository(tx),
    challenges: new DrizzleChallengeRepository(tx),
    sessions: new DrizzleSessionRepository(tx),
  });

  const engagement = makeEngagement({
    coupons: new DrizzleCouponRepository(db),
    claims: new DrizzleClaimRepository(db),
    lists: new DrizzleListRepository(db),
    watches: new DrizzleWatchRepository(db),
    rewards: new DrizzleRewardRepository(db),
    coins: new DrizzleCoinRepository(db),
    // Coins and the coupon they buy move together.
    uow: unitOfWork(db, (tx) => ({ coins: new DrizzleCoinRepository(tx), claims: new DrizzleClaimRepository(tx) })),
    clock,
    newId: () => newId(),
  });

  const contentRepos = (tx: Database) => ({
    videos: new DrizzleVideoRepository(tx),
    comments: new DrizzleCommentRepository(tx),
    notes: new DrizzleNoteRepository(tx),
    reviews: new DrizzleReviewRepository(tx),
    questions: new DrizzleQuestionRepository(tx),
    likes: new DrizzleLikeRepository(tx),
    reports: new DrizzleReportRepository(tx),
  });
  const content = contentRepos(db);
  const { storage, privateStorage, encoder, premoderated } = options.media ?? media();

  const onboarding = makeOnboarding({
    applications: new DrizzleApplicationRepository(db),
    memberships: new DrizzleMembershipRepository(db),
    shops: new CatalogShops(sellers),
    documents: privateStorage,
    // Opening the shop, the owner's membership and the decision commit together.
    uow: unitOfWork(db, (tx) => ({
      applications: new DrizzleApplicationRepository(tx),
      memberships: new DrizzleMembershipRepository(tx),
      shops: new CatalogShops(new DrizzleSellerRepository(tx)),
      events: new OutboxEventLog(tx, () => clock.now()),
    })),
    clock,
    newId: () => newId(),
  });

  const affiliates = makeAffiliates({
    ...affiliatesRepos(db),
    orders: new OrderingReferrals(new DrizzleOrderRepository(db)),
    members: { runsShop: async (accountId: string, sellerId: string) => (await onboarding.members(sellerId)).includes(accountId) },
    // A commission's new state and its event commit together.
    uow: unitOfWork(db, (tx) => ({ commissions: new DrizzleCommissionRepository(tx), events: new OutboxEventLog(tx, () => clock.now()) })),
    clock,
    newId: () => newId(),
  });

  const escrow = makeEscrow({
    ledger: new DrizzleLedger(db),
    disbursements: new DrizzleDisbursementRepository(db),
    invoices: new DrizzleInvoiceRepository(db),
    orders: new OrderingTotals(new DrizzleOrderRepository(db)),
    wallets: new MerchantWallets(
      () => onboarding,
      () => affiliates,
    ),
    // A creator who referred the order is paid out of the shop's release.
    referrals: { forRelease: (orderId: string, sellerId: string) => affiliates.forRelease(orderId, sellerId) },
    // A transfer's record, its journal and its event commit together.
    uow: unitOfWork(db, (tx) => ({ ledger: new DrizzleLedger(tx), disbursements: new DrizzleDisbursementRepository(tx), events: new OutboxEventLog(tx, () => clock.now()) })),
    clock,
    newId: () => newId(),
    commissionRate: serverEnv.PLATFORM_COMMISSION,
    payoutRail: "usdc-base",
  });

  const chops = makeChops({
    chops: new DrizzleChopRepository(db),
    products: {
      livePrice: async (sellerId: string, slug: string) => {
        const [p] = await products.findBySlugs([slug]);
        return p && p.sellerId === sellerId && p.status === "active" ? p.price : null;
      },
    },
    // A chop, its reserved stock and its first cut (or a finishing cut and its event) commit together.
    uow: unitOfWork(db, (tx) => ({ chops: new DrizzleChopRepository(tx), events: new OutboxEventLog(tx, () => clock.now()) })),
    clock,
    newId: () => newId(),
    newCode: () => pollId(random),
  });

  const promos = makePromos({
    drops: new DrizzleDropRepository(db),
    holds: new DrizzlePromoHoldRepository(db),
    teams: new DrizzleTeamRepository(db),
    reminders: new DrizzleReminderRepository(db),
    products: {
      livePrice: async (sellerId: string, slug: string) => {
        const [p] = await products.findBySlugs([slug]);
        return p && p.sellerId === sellerId && p.status === "active" ? p.price : null;
      },
    },
    // Stock taken and the hold it buys (or a team filling, its holds and event) commit together.
    uow: unitOfWork(db, (tx) => ({
      drops: new DrizzleDropRepository(tx),
      holds: new DrizzlePromoHoldRepository(tx),
      teams: new DrizzleTeamRepository(tx),
      events: new OutboxEventLog(tx, () => clock.now()),
    })),
    clock,
    newId: () => newId(),
    newCode: () => pollId(random),
  });

  const bus = options.bus ?? liveBus(db);
  const live = makeLive({
    shows: new DrizzleShowRepository(db),
    chat: new DrizzleChatRepository(db),
    lots: new DrizzleLotRepository(db),
    holds: new DrizzleHoldRepository(db),
    bus,
    catalog: new CatalogForLive(products),
    media: serverEnv.LIVE_INGEST_URL ? { ingest: serverEnv.LIVE_INGEST_URL.replace(/\/$/, ""), playback: (serverEnv.LIVE_PLAYBACK_URL ?? serverEnv.LIVE_INGEST_URL).replace(/\/$/, "") } : null,
    // A closed lot, the winner's hold and the event commit together.
    uow: unitOfWork(db, (tx) => ({ shows: new DrizzleShowRepository(tx), lots: new DrizzleLotRepository(tx), holds: new DrizzleHoldRepository(tx), events: new OutboxEventLog(tx, () => clock.now()) })),
    clock,
    newId: () => newId(),
    newKey: () => randomBytes(24).toString("base64url"),
  });

  const searchShops = makeSearchShops({ search: productSearch });
  const sourcing = makeSourcing({
    rfqs: new DrizzleRfqRepository(db),
    quotes: new DrizzleQuoteRepository(db),
    shops: {
      match: async (text: string, limit: number) => (await searchShops(text, limit)).filter((s) => s.matching > 0).map((s) => s.id),
      sellerOf: async (slug: string) => {
        const [p] = await products.findBySlugs([slug]);
        return p && p.status === "active" ? p.sellerId : null;
      },
    },
    // A request or quote and its event commit together.
    uow: unitOfWork(db, (tx) => ({ rfqs: new DrizzleRfqRepository(tx), quotes: new DrizzleQuoteRepository(tx), events: new OutboxEventLog(tx, () => clock.now()) })),
    clock,
    newId: () => newId(),
    newCode: () => pollId(random),
  });

  const deposits = makeDeposits({
    deposits: new DrizzleDepositRepository(db),
    listings: {
      owns: async (sellerId: string, slug: string) => {
        const [p] = await products.findBySlugs([slug]);
        return !!p && p.sellerId === sellerId && p.status === "active" && p.price !== null;
      },
    },
    clock,
    newId: () => newId(),
  });

  // The order, its invoice and the coupon it takes are written in one transaction.
  const checkoutUow = unitOfWork(db, (tx) => ({
    orders: new DrizzleOrderRepository(tx),
    gifts: new DrizzleGiftRepository(tx),
    payments: { request: makeRequestPayment({ network, invoices: new DrizzleInvoiceRepository(tx), clock, newId: () => newId(), newTag }) },
    coupons: { reserve: (buyerId: string, couponId: string, orderId: string) => new DrizzleClaimRepository(tx).reserve(buyerId, couponId, orderId) },
    events: new OutboxEventLog(tx, () => clock.now()),
  }));

  // The lowest price the buyer holds for this many units: a live price, an auction win, a
  // chop, a drop or a team, an accepted quote, or a pre-order's balance. Checkout and the bag both use it.
  const holds: PriceHolds = {
    best: async (buyerId: string, slug: string, qty: number) => {
      const held = (await Promise.all([live.bestHold(buyerId, slug), chops.bestHold(buyerId, slug), promos.bestHold(buyerId, slug), sourcing.bestHold(buyerId, slug, qty), deposits.bestHold(buyerId, slug)])).filter(
        (h): h is NonNullable<typeof h> => h !== null && qty <= h.qty && qty >= ("minQty" in h ? h.minQty : 1),
      );
      return held.length ? held.reduce((a, b) => (b.price < a.price ? b : a)) : null;
    },
  };

  const checkInvoice = makeCheckInvoice({
    network,
    invoices: new DrizzleInvoiceRepository(db),
    // Invoice, ledger journal, order status and the order's coupon settle in one transaction.
    uow: unitOfWork(db, (tx) => {
      const orders = new DrizzleOrderRepository(tx);
      const shipments = new DrizzleShipmentRepository(tx);
      const claims = new DrizzleClaimRepository(tx);
      const events = new OutboxEventLog(tx, () => clock.now());
      return {
        invoices: new DrizzleInvoiceRepository(tx),
        ledger: new DrizzleLedger(tx),
        events,
        orderPaid: async (orderId: string, at: Date) => {
          const r = await makeMarkOrderPaid({ orders, shipments, events })(orderId, at);
          if (r.ok) await claims.redeemForOrder(orderId, at);
          return r;
        },
        orderLapsed: async (orderId: string) => {
          const r = await makeCancelUnpaidOrder({ orders, events, clock })(orderId);
          if (r.ok) await claims.releaseForOrder(orderId);
          return r;
        },
      };
    }),
    clock,
    newId: () => newId(),
  });

  return {
    identity: makeIdentity({
      ...identityRepos(db),
      uow: unitOfWork(db, identityRepos),
      secrets: new NodeSecrets(authSecret()),
      mailer:
        serverEnv.RESEND_API_KEY && serverEnv.EMAIL_FROM
          ? new ResendMailer({ apiKey: serverEnv.RESEND_API_KEY, from: serverEnv.EMAIL_FROM, appName: brand.name })
          : new ConsoleMailer(),
      verifier: new ViemVerifier(),
      clock,
      newId: () => newId(),
      revealCodes: serverEnv.AUTH_DEV_CODES,
    }),
    listMarkets: makeListMarkets({ countries, fx: new DrizzleFxRateRepository(db) }),
    catalog: makeCatalogQueries({ categories: new DrizzleCategoryRepository(db), sellers, products, clock }),
    ratings: makeRatings({ products, sellers }),
    catalogAdmin: makeCatalogAdmin({ products, sellers }),
    coupons: makeCouponDesk({ coupons: new DrizzleCouponRepository(db), claims: new DrizzleClaimRepository(db), clock, newId: () => newId() }),
    selling: makeSelling({ products, categories: new DrizzleCategoryRepository(db), sellers, photos: storage, clock, newId: () => newId() }),
    searchProducts: makeSearchProducts({ search: productSearch, sellers, clock }),
    searchShops,
    sourcing,
    engagement,
    chops,
    promos,
    boards: makeBoards({ boards: new DrizzleBoardRepository(db), clock, newCode: () => pollId(random) }),
    blindBoxes: makeBlindBoxes({
      boxes: new DrizzleBlindBoxRepository(db),
      clock,
      newId: () => newId(),
      random,
      listings: {
        owns: async (sellerId: string, slug: string) => {
          const [p] = await products.findBySlugs([slug]);
          return !!p && p.sellerId === sellerId && p.status === "active" && p.price !== null;
        },
      },
    }),
    rewards: makeRewards({
      coins: new DrizzleCoinRepository(db),
      activity: new AppActivity({
        orders: new DrizzleOrderRepository(db),
        products,
        reviews: content.reviews,
        lists: new DrizzleListRepository(db),
        polls: new DrizzlePollRepository(db),
        chops: new DrizzleChopRepository(db),
        lots: new DrizzleLotRepository(db),
        commissions: new DrizzleCommissionRepository(db),
        accounts: new DrizzleAccountRepository(db),
      }),
      clock,
      newId: () => newId(),
    }),
    polls: makePolls({ polls: new DrizzlePollRepository(db), clock }),
    content: makeContentQueries({ ...content, clock }),
    interactions: makeInteractions({
      videos: content.videos,
      likes: content.likes,
      reviews: content.reviews,
      products: new CatalogProductDirectory(products),
      purchases: new OrderingPurchases(new DrizzleOrderRepository(db), new DrizzleShipmentRepository(db)),
      // A like and its counter, or a comment and the video's count, move together.
      uow: unitOfWork(db, (tx) => ({ ...contentRepos(tx), events: new OutboxEventLog(tx, () => clock.now()) })),
      clock,
      newId: () => newId(),
    }),
    uploads: makeUploads({
      storage,
      videos: content.videos,
      products: new CatalogProductDirectory(products),
      encoder,
      uow: unitOfWork(db, (tx) => ({ videos: new DrizzleVideoRepository(tx), events: new OutboxEventLog(tx, () => clock.now()) })),
      clock,
      newId: () => newId(),
      premoderated,
    }),
    moderation: makeModeration({
      ...content,
      // A takedown, its counters, the closed reports and the event commit together.
      uow: unitOfWork(db, (tx) => ({ ...contentRepos(tx), events: new OutboxEventLog(tx, () => clock.now()) })),
      clock,
      newId: () => newId(),
    }),
    storage,
    privateStorage,
    onboarding,
    cart: makeCart({ carts: new DrizzleCartRepository(db), catalog: pricing, holds }),

    live,
    affiliates,
    messaging: makeMessaging({
      conversations: new DrizzleConversationRepository(db),
      messages: new DrizzleMessageRepository(db),
      shops: { exists: async (sellerId: string) => (await sellers.findById(sellerId as SellerId)) !== null },
      // A message, the conversation's latest line and its event commit together.
      uow: unitOfWork(db, (tx) => ({ conversations: new DrizzleConversationRepository(tx), messages: new DrizzleMessageRepository(tx), events: new OutboxEventLog(tx, () => clock.now()) })),
      clock,
      newId: () => newId(),
    }),
    samples: makeSamples({
      samples: new DrizzleSampleRepository(db),
      members: { runsShop: async (accountId: string, sellerId: string) => (await onboarding.members(sellerId)).includes(accountId) },
      products: {
        live: async (sellerId: string, slug: string) => {
          const [p] = await products.findBySlugs([slug]);
          return !!p && p.sellerId === sellerId && p.status === "active";
        },
      },
      // A request, the sample it takes (or gives back) and its event commit together.
      uow: unitOfWork(db, (tx) => ({ samples: new DrizzleSampleRepository(tx), events: new OutboxEventLog(tx, () => clock.now()) })),
      clock,
      newId: () => newId(),
    }),
    ads: makeAds({
      campaigns: new DrizzleCampaignRepository(db),
      stats: new DrizzleAdStatsRepository(db),
      billing: new EscrowAdBilling(() => escrow),
      products: new CatalogAdProducts(products),
      signer: new HmacSigner(authSecret(), "ad-clicks"),
      clock,
      newId: () => newId(),
    }),
    /** Live updates for viewers connected to this process (the stream route subscribes). */
    liveBus: bus,
    checkout: makeCheckout({
      catalog: pricing,
      holds,
      destinations: new MarketDestinations(countries),
      coupons: new WalletCoupons(engagement),
      uow: checkoutUow,
      clock,
      newId: () => newId(),
      newOrderNumber: () => orderNumber("LY", random),
      newToken: () => randomBytes(18).toString("base64url"),
    }),
    deposits,
    depositCheckout: makeDepositCheckout({ catalog: pricing, destinations: new MarketDestinations(countries), uow: checkoutUow, clock, newId: () => newId(), newOrderNumber: () => orderNumber("LY", random) }),
    closeDeposit: makeCloseDeposit({ orders: new DrizzleOrderRepository(db) }),
    getOrder: makeGetOrder({ orders: new DrizzleOrderRepository(db) }),
    sellerOrders: makeSellerOrders({ orders: new DrizzleOrderRepository(db), shipments: new DrizzleShipmentRepository(db), gifts: new DrizzleGiftRepository(db) }),
    gifts: makeGifts({
      gifts: new DrizzleGiftRepository(db),
      orders: new DrizzleOrderRepository(db),
      // The address, the claimed gift and its event commit together.
      uow: unitOfWork(db, (tx) => ({ orders: new DrizzleOrderRepository(tx), gifts: new DrizzleGiftRepository(tx), events: new OutboxEventLog(tx, () => clock.now()) })),
      clock,
    }),
    fulfilment: makeFulfilment({
      orders: new DrizzleOrderRepository(db),
      shipments: new DrizzleShipmentRepository(db),
      // A parcel's state, its event and the order closing commit together.
      uow: unitOfWork(db, (tx) => ({ orders: new DrizzleOrderRepository(tx), shipments: new DrizzleShipmentRepository(tx), events: new OutboxEventLog(tx, () => clock.now()) })),
      clock,
    }),
    escrow,
    notifications: makeNotifications({
      notifications: new DrizzleNotificationRepository(db),
      email: serverEnv.RESEND_API_KEY && serverEnv.EMAIL_FROM ? new ResendEmail({ apiKey: serverEnv.RESEND_API_KEY, from: serverEnv.EMAIL_FROM }) : new ConsoleEmail(),
      directory: new IdentityEmails(new DrizzleAccountRepository(db)),
      clock,
      newId: () => newId(),
      siteUrl: brand.url,
      appName: brand.name,
    }),

    checkInvoice,
    /** The invoice opened for an order (to pay it later). */
    invoiceIdFor: async (orderId: string) => (await new DrizzleInvoiceRepository(db).findByOrder(orderId))?.id ?? null,
    syncInvoices: makeSyncInvoices({ invoices: new DrizzleInvoiceRepository(db), checkInvoice, clock }),
    ledger: new DrizzleLedger(db),
    refreshRates: makeRefreshRates({ source: new OpenErApiRateSource(), fx: new DrizzleFxRateRepository(db), clock }),
    rateLimiter: new PostgresRateLimiter(db, () => clock.now()),
    outbox: new OutboxDispatcher(db, {}, { now: () => clock.now() }),
    db,
    /** Development only: pretends the buyer paid an invoice. Null outside simulated mode. */
    simulatePayment: simulator
      ? async (invoiceId: string) => {
          const invoice = await new DrizzleInvoiceRepository(db).findById(invoiceId);
          if (invoice) await simulator.send(invoice, clock.now());
          return invoice !== null;
        }
      : null,
  };
}

export type Services = ReturnType<typeof wire>;

// Wiring is cheap, so it lives in module scope: a dev hot reload of this file rewires
// everything with the new code. The database connection underneath is the long-lived part.
let wired: Promise<Services> | undefined;

export function services(): Promise<Services> {
  wired ??= getDb()
    .then((db) => wire(db))
    .catch((error) => {
      wired = undefined;
      throw error;
    });
  return wired;
}
