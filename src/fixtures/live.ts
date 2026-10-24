// Fixture data for the design phase. Every name, price and count is illustrative.
import { portrait, square } from "@/lib/images";
import type { LiveReplay, LiveRoomData, LiveShow } from "@/lib/types";

const portraitOf = (id: string, fx = 0.5, fy = 0.5) => portrait(id, fx, fy);

/** Rooms on air now. The first is the flagship beauty show. */
export const liveRooms: LiveRoomData[] = [
  {
    id: "glowlab",
    kind: "show",
    hostName: "Ava",
    sellerId: "glowlab",
    title: "Lip swatches and a skincare Q&A",
    image: portraitOf("1592150282082-37698debe277", 0.5, 0.4),
    place: "Guangzhou studio",
    viewers: 12400,
    items: [
      { slug: "lip-set-velvet", livePrice: 12, status: "on-air" },
      { slug: "skincare-rose-starter", livePrice: 22, status: "shown" },
      { slug: "serum-niacinamide", livePrice: 7.9, status: "next" },
      { slug: "cream-ceramide", livePrice: 11, status: "next" },
    ],
    pinned: { q: "Does it ship to Ghana and Nigeria?", a: "Yes, 6 to 9 days, and duties are paid at checkout." },
    comments: [
      { name: "kofi.a", text: "Does it ship to Accra?" },
      { name: "Ava", text: "Yes! 6–9 days, duties paid at checkout.", host: true },
      { name: "mia.lund", text: "Shade 03 on camera please" },
      { name: "ravi.k", text: "Just bought two" },
      { name: "sofia.r", text: "Is the formula vegan?" },
    ],
  },
  {
    id: "sunvolt-tour",
    kind: "tour",
    hostName: "Chen",
    sellerId: "sunvolt",
    title: "Factory floor: how a 450 W panel is made",
    image: portraitOf("1624397640148-949b1732bb0a", 0.33),
    place: "Changzhou, Jiangsu",
    viewers: 5300,
    items: [
      { slug: "solar-panel-450w-bifacial", livePrice: 52, status: "on-air" },
      { slug: "balcony-solar-800w", livePrice: 249, status: "next" },
    ],
    pinned: { q: "Can I order one panel, not a pallet?", a: "Yes. From 1 panel, with pallet pricing from 30." },
    comments: [
      { name: "amara.o", text: "What's the warranty in Nigeria?" },
      { name: "Chen", text: "25 years on output, claims handled locally.", host: true },
      { name: "kofi_builds", text: "Show the EL test again please" },
      { name: "lin.outdoors", text: "That laminator is huge" },
    ],
  },
  {
    id: "mei-fitting",
    kind: "show",
    hostName: "Mei",
    sellerId: "mei",
    title: "Qipao fittings: send your measurements live",
    image: portraitOf("1679032658892-e3bb9e057834", 0.5, 0.4),
    place: "Suzhou atelier",
    viewers: 8900,
    items: [
      { slug: "qipao-silk-made-to-measure", livePrice: 118, status: "on-air" },
      { slug: "hanfu-crimson", livePrice: 149, status: "next" },
      { slug: "silk-charmeuse-by-metre", livePrice: 14, status: "shown" },
    ],
    pinned: { q: "How do I measure myself?", a: "Tap Ask seller under any product for the 3-minute guide." },
    comments: [
      { name: "sofia.r", text: "The green one is stunning" },
      { name: "Mei", text: "Jade silk, 19 momme. I'll show it in daylight.", host: true },
      { name: "mia.lund", text: "Can you do a shorter sleeve?" },
    ],
  },
  {
    id: "sztech-demo",
    kind: "show",
    hostName: "Jun",
    sellerId: "sztech",
    title: "Drone range test over Shenzhen Bay",
    image: portraitOf("1739742465286-a48290c94375"),
    place: "Shenzhen Bay",
    viewers: 3700,
    items: [
      { slug: "drone-mini-4k", livePrice: 189, status: "on-air" },
      { slug: "earbuds-anc", livePrice: 24, status: "next" },
      { slug: "power-bank-20k", livePrice: 21, status: "next" },
    ],
    pinned: { q: "Is it under 249 g?", a: "Yes, 245 g, so no registration in most countries." },
    comments: [
      { name: "jun.w", text: "How far before it drops signal?" },
      { name: "Jun", text: "We're at 6 km now and still 1080p.", host: true },
      { name: "ravi.k", text: "Wind resistance?" },
    ],
  },
];

/** The flagship room, kept under its old name for search and the side nav. */
export const liveRoom = liveRooms[0];

/** Shows scheduled from now, in hours. */
export const liveSchedule: LiveShow[] = [
  { id: "jade-grading", sellerId: "lantian", hostName: "Bo", title: "Jade grading: A, B or C? Bring your questions", image: square("1767040276964-d2a39a86b1d4"), inHours: 2, kind: "show" },
  { id: "ev-walkaround", sellerId: "evdesk", hostName: "Hao", title: "Export EV walkaround and landed quotes, live", image: square("1760435107985-40b6872c8c97", 0.6), inHours: 5, kind: "tour" },
  { id: "tea-harvest", sellerId: "jintea", hostName: "Lin", title: "Longjing harvest tasting from the terraces", image: square("1776341846906-b7609c6f7f25"), inHours: 20, kind: "tour" },
  { id: "silver-auction", sellerId: "miao", hostName: "Ayi", title: "Miao silver auction: 12 lots, from $20", image: square("1781450951227-21372c89db8c", 0.5, 0.45), inHours: 26, kind: "auction" },
];

/** Past shows you can still shop. */
export const liveReplays: LiveReplay[] = [
  { id: "glamp", sellerId: "voltgrid", title: "Camping off-grid for a week on one power station", image: portraitOf("1678775883148-6642c67015f5", 0.45, 0.55), minutes: 52, views: 41000, products: 4 },
  { id: "lanterns", sellerId: "yiwu", title: "Lantern market haul: 40 sets for a café", image: portraitOf("1735126419093-9cf5c85320a3"), minutes: 38, views: 22600, products: 6 },
  { id: "street", sellerId: "streetlab", title: "Fit check: building three looks under $120", image: portraitOf("1624353656309-8be1a6c457be", 0.5, 0.4), minutes: 44, views: 63000, products: 9 },
];

/** "Just bought" toasts in live rooms. */
export const livePurchases = [
  { name: "ravi.k", city: "Mumbai" },
  { name: "amara.o", city: "Accra" },
  { name: "sofia.r", city: "São Paulo" },
  { name: "kofi_builds", city: "Lagos" },
  { name: "mia.lund", city: "Berlin" },
  { name: "lin.outdoors", city: "Sydney" },
];

export const auctionRoom = {
  sellerId: "hustudio",
  hostName: "Lan",
  image: portrait("1772785952443-cdf58994e444", 0.5, 0.4),
  lots: [
    { title: "Qinghua meiping vase, pine and crane", image: square("1723779234372-023dd09385ef"), start: 40, current: 86 },
    { title: "Crane vase on cobalt ground", image: square("1723779232054-6f6be572c0e8"), start: 60, current: 60 },
  ],
};

