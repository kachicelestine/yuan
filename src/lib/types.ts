// Domain types shared by fixtures, the query layer and the UI.
import type { ProductView } from "@/modules/catalog";

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

export type Comment = {
  name: string;
  avatar: string;
  text: string;
  likes: number;
  ago: string;
  /** Written by the seller of the product in the video. */
  seller?: boolean;
};

export type Video = {
  id: string;
  sellerId: string;
  productSlug: string;
  /** More products tagged in the same video (shop the look). */
  also?: string[];
  /** A real clip (Mixkit, free licence) that plays over the still once the slide is active. */
  clip?: string;
  /** Where each tagged product sits in the frame, as percentages of a 9:19.5 crop. */
  spots?: { slug: string; x: number; y: number }[];
  image: string;
  /** Media is bright under the controls, so glass should darken to stay legible. */
  tone: "light" | "dark";
  caption: string;
  tags: string[];
  place: string;
  likes: number;
  comments: number;
  saves: number;
  shares: number;
  topComments: Comment[];
};

export type Note = {
  id: string;
  title: string;
  image: string;
  /** Rendered height in the waterfall, as a 3:4-ish ratio hint. */
  ratio: "tall" | "square" | "wide";
  authorName: string;
  authorAvatar: string;
  likes: number;
  productSlug?: string;
  live?: boolean;
  video?: boolean;
  category: CategoryId;
};

export type LiveItem = { slug: string; livePrice: number; status: "on-air" | "shown" | "next" };

export type TeamBuy = { slug: string; teamPrice: number; size: number; teams: { leader: string; avatar: string; joined: string[]; endsInSec: number }[] };

export type FlashDeal = { slug: string; dealPrice: number; claimed: number };

export type { Region } from "@/modules/markets";

/** A country we ship to, as the UI sees it (see the markets module). */
export type { MarketView as Market } from "@/modules/markets";

/** A Snap to search sample photo and the matches a vision model would return for it. */
export type SnapSample = { id: string; label: string; image: string; guess: string; matches: [slug: string, score: number][] };

export type Review = {
  id: string;
  productSlug: string;
  author: string;
  avatar: string;
  /** Market code of the buyer's country. */
  country: string;
  rating: number;
  text: string;
  /** Set when the review was machine-translated; `original` keeps the buyer's words. */
  translatedFrom?: string;
  original?: string;
  photos?: string[];
  option?: string;
  date: string;
  helpful: number;
  sellerReply?: string;
};

export type Question = {
  id: string;
  productSlug: string;
  question: string;
  answer: string;
  answeredBy: "seller" | "buyer";
  asker: string;
  votes: number;
};


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

export type Mission = { id: string; title: string; reward: number; progress: number; goal: number; href: string };
export type Badge = { id: string; name: string; detail: string; earned: boolean; icon: string };
export type RewardItem = { id: string; title: string; cost: number; couponId: string };

export type Board = { id: string; name: string; owner: string; ownerAvatar: string; slugs: string[]; followers?: number };

export type CreatorLink = { slug: string; commission: number; clicks: number; orders: number; earned: number };

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
export type Poll = {
  id: string;
  by: string;
  avatar?: string;
  question: string;
  hoursLeft: number;
  options: { slug: string; votes: number; voters: string[] }[];
  comments: { name: string; avatar: string; text: string; pick: number }[];
};

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
