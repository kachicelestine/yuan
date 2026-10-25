// Domain types shared by fixtures, the query layer and the UI.
import type { ProductView, SellerView, ShopResult } from "@/modules/catalog";
import type { CommentView, NoteView, QuestionView, ReviewView, VideoView } from "@/modules/content";
import type { ShowView } from "@/modules/live";

/** A category slug. Categories live in the database now, so this is open-ended. */
export type CategoryId = string;

/** A category as the UI sees it (see the catalog module). */
export type { CategoryView as Category } from "@/modules/catalog";

/** A manufacturing cluster ("factory town") and the sellers we have there. */
export type FactoryTown = {
  id: string;
  name: string;
  province: string;
  speciality: string;
  fact: string;
  image: string;
  sellerIds: string[];
  /** The export port most goods from here leave through. */
  port: string;
};

export type { SellerKind } from "@/modules/catalog";

export type { SellerView as Seller } from "@/modules/catalog";

/** Storefront details for a seller: reputation, factory facts and where they already ship. */
export type { StorefrontView as SellerProfile } from "@/modules/catalog";

export type OptionValue = { label: string; sub?: string; /** Added to every tier price. */ delta?: number; swatch?: string };
export type ProductOption = { name: string; values: OptionValue[]; defaultIndex?: number };
export type Tier = { min: number; price: number };

/**
 * A product as the UI sees it. Database-backed screens get the catalog's ProductView;
 * design-phase fixtures fit the same shape without its id, lead time and seller summary.
 */
export type Product = Omit<ProductView, "id" | "leadTime" | "seller"> & Partial<Pick<ProductView, "id" | "leadTime" | "seller">>;

/** A comment under a video (see the content module). Fixtures leave out the id and time. */
export type Comment = Omit<CommentView, "id" | "at"> & Partial<Pick<CommentView, "id" | "at">>;

/**
 * A shoppable video as the UI sees it. Database-backed screens get the content module's
 * VideoView; design-phase fixtures fit the same shape without renditions or view counts.
 */
export type Video = Omit<VideoView, "renditions" | "views" | "topComments"> & Partial<Pick<VideoView, "renditions" | "views">> & { topComments: Comment[] };

/** One slide of the feed: the video, what it sells, and what the shop sheet shows beside it. */
export type FeedItem = {
  video: Video;
  product: Product;
  seller: SellerView;
  /** Picked on the server for the sheet's More tab. */
  related: { fromSeller: Product[]; similar: Product[]; category: string };
  /** The video's product first, then everything else tagged in it. */
  look: Product[];
  /** The creator code of the person who posted it: shopping from their video credits them. */
  ref?: string;
};

/** A page of the feed and where the next one starts (null at the end). */
export type FeedPage = { items: FeedItem[]; next: number | null };

/** A Discover note (see the content module). */
export type Note = NoteView;

export type LiveItem = { slug: string; livePrice: number; status: "on-air" | "shown" | "next" };

export type TeamBuy = { slug: string; teamPrice: number; size: number; teams: { leader: string; avatar: string; joined: string[]; endsInSec: number }[] };

export type FlashDeal = { slug: string; dealPrice: number; claimed: number };

export type { Region } from "@/modules/markets";

/** A country we ship to, as the UI sees it (see the markets module). */
export type { MarketView as Market } from "@/modules/markets";

/** A Snap to search sample photo and the matches a vision model would return for it. */
export type SnapSample = { id: string; label: string; image: string; guess: string; matches: [slug: string, score: number][] };

/** A product review (see the content module). Fixtures don't say whether it's tied to an order. */
export type Review = Omit<ReviewView, "verified"> & Partial<Pick<ReviewView, "verified">>;

/** A buyer's question about a product; the answer is null until someone replies. */
export type Question = QuestionView;

export type ChatMessage = {
  id: string;
  from: "me" | "seller";
  /** Shown text (translated for the shopper when the seller wrote in another language). */
  text: string;
  /** The seller's own words, when `text` is a translation. */
  original?: string;
  at: string;
  product?: string;
  image?: string;
};

export type Thread = { sellerId: string; unread: number; messages: ChatMessage[] };

export type Activity = {
  id: string;
  kind: "price" | "live" | "reply" | "order" | "team" | "coins" | "restock";
  title: string;
  body: string;
  at: string;
  image?: string;
  href: string;
  unread?: boolean;
  group: "Today" | "Earlier";
};

export type JourneyStep = { label: string; detail: string; at?: string; image?: string };

/** An order on its way: where it is, how it travels, and what Protect covers. */
export type Shipment = {
  orderId: string;
  mode: "air" | "sea";
  from: string;
  to: string;
  toCode: string;
  carrier: string;
  tracking: string;
  eta: string;
  /** Index of the step happening now. */
  stage: number;
  steps: JourneyStep[];
  lines: { slug: string; qty: number; option?: string; unitPrice: number }[];
  total: number;
  protectUntil: string;
};

export type Coupon = {
  id: string;
  title: string;
  detail: string;
  /** USD off, or a share off when `percent` is set. */
  value: number;
  percent?: boolean;
  freeShipping?: boolean;
  minSpend: number;
  sellerId?: string;
  expires: string;
};

export type RewardItem = { id: string; title: string; cost: number; couponId: string };

export type Board = { id: string; name: string; owner: string; ownerAvatar: string; slugs: string[]; followers?: number };


export type Quote = { sellerId: string; unitPrice: number; moq: number; leadDays: number; sample: number; note: string };
export type BusinessRfq = { id: string; item: string; qty: number; port: string; incoterm: "FOB" | "CIF" | "DDP"; status: "quoting" | "accepted"; quotes: Quote[] };

export type DropKind = "drop" | "restock" | "preorder" | "presale";

/** A scheduled release. Times are Beijing time, `inDays` from today. */
export type Drop = {
  id: string;
  kind: DropKind;
  slug: string;
  title: string;
  blurb: string;
  inDays: number;
  /** "HH:MM" in Beijing time. */
  time: string;
  waiting: number;
  limit?: string;
  /** Pre-orders and pre-sales: what you pay now and what it counts for later, in USD. */
  deposit?: { pay: number; worth: number };
  ships?: string;
};

/** Price chop: friends each cut an equal share of the gap to a fixed target price. */
export type Chop = {
  id: string;
  slug: string;
  /** Price once every cut is in, USD. */
  target: number;
  /** Cuts needed, yours included. */
  cuts: number;
  hoursLeft: number;
  /** Friends who have already cut. */
  friends: { name: string; avatar: string }[];
};

export type BlindBoxFigure = { id: string; name: string; image: string; secret?: boolean };

/** A blind-box series: every regular figure is equally likely; the secret is rarer. */
export type BlindBoxSeries = {
  id: string;
  slug: string;
  title: string;
  studio: string;
  poster: string;
  /** One box in this many holds the secret. */
  secretOdds: number;
  figures: BlindBoxFigure[];
};

export type GiftTheme = { id: string; label: string; seal: string; bg: string };

/** A gift sent by link: the recipient adds their own address and, if allowed, picks the option. */
export type Gift = {
  id: string;
  slug: string;
  from: string;
  avatar?: string;
  to: string;
  /** Recipient's market code. */
  market: string;
  theme: string;
  message: string;
  hidePrice: boolean;
  theyChoose: boolean;
  wrap: boolean;
};

/** A "this or that?" poll friends vote on before the asker buys. */
export type LiveKind = "show" | "tour" | "auction";

export type LiveRoomData = {
  id: string;
  kind: LiveKind;
  hostName: string;
  sellerId: string;
  title: string;
  image: string;
  place: string;
  viewers: number;
  items: LiveItem[];
  /** A question the host pinned above the chat. */
  pinned: { q: string; a: string };
  comments: { name: string; text: string; host?: boolean }[];
};

export type LiveShow = { id: string; sellerId: string; hostName: string; title: string; image: string; inHours: number; kind: LiveKind };

export type LiveReplay = { id: string; sellerId: string; title: string; image: string; minutes: number; views: number; products: number };

/** What a search finds besides products (GET /api/search/all). */
export type VideoHit = { id: string; image: string; tone: "light" | "dark"; likes: number; views: number; title: string; sellerName: string };
export type LiveHit = Pick<ShowView, "id" | "title" | "hostName" | "kind" | "coverUrl" | "place" | "peakViewers" | "scheduledFor"> & {
  status: "live" | "scheduled";
  sellerName: string;
};
export type SearchAll = { videos: VideoHit[]; shops: ShopResult[]; live: LiveHit[] };
