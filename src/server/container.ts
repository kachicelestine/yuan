import "server-only";
import { brand } from "@/config/brand";
import { serverEnv } from "@/config/server-env";
import { makeCatalogQueries, makeSearchProducts } from "@/modules/catalog";
import { DrizzleCategoryRepository, DrizzleProductRepository, DrizzleSellerRepository } from "@/modules/catalog/infrastructure/drizzle-catalog-repositories";
import { DrizzleProductSearch } from "@/modules/catalog/infrastructure/drizzle-product-search";
import { makeContentQueries, makeInteractions } from "@/modules/content";
import {
  DrizzleCommentRepository,
  DrizzleLikeRepository,
  DrizzleNoteRepository,
  DrizzleQuestionRepository,
  DrizzleReviewRepository,
  DrizzleVideoRepository,
} from "@/modules/content/infrastructure/drizzle-content-repositories";
import { makeEngagement } from "@/modules/engagement";
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
import { makeListMarkets, makeRefreshRates } from "@/modules/markets";
import { DrizzleCountryRepository, DrizzleFxRateRepository } from "@/modules/markets/infrastructure/drizzle-markets-repository";
import { OpenErApiRateSource } from "@/modules/markets/infrastructure/open-er-api-rate-source";
import { makeCancelUnpaidOrder, makeCart, makeCheckout, makeGetOrder, makeMarkOrderPaid, orderNumber } from "@/modules/ordering";
import { DrizzleCartRepository } from "@/modules/ordering/infrastructure/drizzle-cart-repository";
import { DrizzleOrderRepository } from "@/modules/ordering/infrastructure/drizzle-order-repository";
import { makeCheckInvoice, makeRequestPayment, makeSyncInvoices, type PaymentNetwork } from "@/modules/payments";
import { BaseUsdcNetwork } from "@/modules/payments/infrastructure/base-usdc-network";
import { DrizzleInvoiceRepository, DrizzleLedger } from "@/modules/payments/infrastructure/drizzle-payments-repositories";
import { RailRouter, SimulatedNetwork } from "@/modules/payments/infrastructure/networks";
import type { Database } from "@/shared/infrastructure/database";
import { OutboxDispatcher, OutboxEventLog } from "@/shared/infrastructure/outbox";
import { PostgresRateLimiter } from "@/shared/infrastructure/rate-limit";
import { unitOfWork } from "@/shared/infrastructure/unit-of-work";
import { newId, systemClock, type Clock } from "@/shared/kernel";
import { CatalogProductDirectory } from "./adapters/content-products";
import { WalletCoupons } from "./adapters/coupons";
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
  const base = new BaseUsdcNetwork({ rpcUrl: serverEnv.PAYMENTS_BASE_RPC_URL!, treasury: serverEnv.PAYMENTS_BASE_ADDRESS!, chain: serverEnv.PAYMENTS_BASE_CHAIN });
  return { network: new RailRouter({ "usdc-base": base }), simulator: null };
}

/** What tests swap out; production uses the defaults. */
export type WireOptions = { clock?: Clock; newTag?: () => number; payments?: Payments };

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
  });
  const content = contentRepos(db);

  const checkInvoice = makeCheckInvoice({
    network,
    invoices: new DrizzleInvoiceRepository(db),
    // Invoice, ledger journal, order status and the order's coupon settle in one transaction.
    uow: unitOfWork(db, (tx) => {
      const orders = new DrizzleOrderRepository(tx);
      const claims = new DrizzleClaimRepository(tx);
      const events = new OutboxEventLog(tx, () => clock.now());
      return {
        invoices: new DrizzleInvoiceRepository(tx),
        ledger: new DrizzleLedger(tx),
        events,
        orderPaid: async (orderId: string, at: Date) => {
          const r = await makeMarkOrderPaid({ orders, events })(orderId, at);
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
    searchProducts: makeSearchProducts({ search: new DrizzleProductSearch(db), sellers, clock }),
    engagement,
    content: makeContentQueries({ ...content, clock }),
    interactions: makeInteractions({
      videos: content.videos,
      likes: content.likes,
      products: new CatalogProductDirectory(products),
      // A like and its counter, or a comment and the video's count, move together.
      uow: unitOfWork(db, (tx) => ({ ...contentRepos(tx), events: new OutboxEventLog(tx, () => clock.now()) })),
      clock,
      newId: () => newId(),
    }),
    cart: makeCart({ carts: new DrizzleCartRepository(db), catalog: pricing }),

    checkout: makeCheckout({
      catalog: pricing,
      destinations: new MarketDestinations(countries),
      coupons: new WalletCoupons(engagement),
      // The order, its invoice and the coupon it takes are written in one transaction.
      uow: unitOfWork(db, (tx) => ({
        orders: new DrizzleOrderRepository(tx),
        payments: { request: makeRequestPayment({ network, invoices: new DrizzleInvoiceRepository(tx), clock, newId: () => newId(), newTag }) },
        coupons: { reserve: (buyerId: string, couponId: string, orderId: string) => new DrizzleClaimRepository(tx).reserve(buyerId, couponId, orderId) },
        events: new OutboxEventLog(tx, () => clock.now()),
      })),
      clock,
      newId: () => newId(),
      newOrderNumber: () => orderNumber("LY", random),
    }),
    getOrder: makeGetOrder({ orders: new DrizzleOrderRepository(db) }),

    checkInvoice,
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
