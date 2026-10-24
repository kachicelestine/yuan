// Fixture data for the design phase: one shopper's account (orders in transit, rewards,
// coupons, boards, creator earnings and a business quote request).
import { avatar, square } from "@/lib/images";
import type { Badge, Board, BusinessRfq, Coupon, CreatorLink, Mission, RewardItem, Shipment } from "@/lib/types";
import { people } from "./people";

export const demoShipment: Shipment = {
  orderId: "OR-7KD2Q9",
  mode: "air",
  from: "Shenzhen",
  to: "Lagos",
  toCode: "NG",
  carrier: "Cainiao air freight",
  tracking: "CNLOS4471920",
  eta: "Thu, Oct 29",
  stage: 4,
  steps: [
    { label: "Order placed", detail: "Paid in USDC on Base. Your money is held by Protect.", at: "Oct 18, 14:02" },
    { label: "Packed at the factory", detail: "Voltgrid Power, Bao'an, Shenzhen. Here's your parcel.", at: "Oct 19, 09:40", image: square("1678775882496-59554c53e32e", 0.45, 0.6) },
    { label: "Picked up", detail: "Handed to Cainiao air freight with all export papers.", at: "Oct 20, 16:15" },
    { label: "Left Shenzhen", detail: "Flight SZX → LOS via Addis Ababa.", at: "Oct 21, 23:50" },
    { label: "Landed in Lagos", detail: "Murtala Muhammed Airport. Customs review has started.", at: "Oct 23, 06:20" },
    { label: "Customs cleared", detail: "Duties were prepaid, so there's nothing to pay." },
    { label: "Out for delivery", detail: "A courier will message you before arriving." },
    { label: "Delivered", detail: "Check it within 3 days, then Protect pays the seller." },
  ],
  lines: [
    { slug: "power-station-2kwh", qty: 1, option: "3 kWh · Graphite", unitPrice: 849 },
    { slug: "earbuds-anc", qty: 2, option: "Black", unitPrice: 39 },
  ],
  total: 1004,
  protectUntil: "Nov 1",
};

export const coupons: Coupon[] = [
  { id: "welcome5", title: "$5 off", detail: "Your first order over $50", value: 5, minSpend: 50, expires: "Nov 30" },
  { id: "freeship", title: "Free express", detail: "Air shipping on orders over $80", value: 18, freeShipping: true, minSpend: 80, expires: "Nov 15" },
  { id: "sunvolt10", title: "10% off", detail: "Sunvolt Energy, orders over $200", value: 0.1, percent: true, minSpend: 200, sellerId: "sunvolt", expires: "Nov 8" },
  { id: "glow3", title: "$3 off", detail: "Glow Lab, orders over $20", value: 3, minSpend: 20, sellerId: "glowlab", expires: "Oct 31" },
  { id: "voltgrid25", title: "$25 off", detail: "Voltgrid Power, orders over $500", value: 25, minSpend: 500, sellerId: "voltgrid", expires: "Nov 12" },
  { id: "street8", title: "8% off", detail: "Canton Street Lab, 2+ items", value: 0.08, percent: true, minSpend: 60, sellerId: "streetlab", expires: "Nov 20" },
];

export const missions: Mission[] = [
  { id: "watch-live", title: "Watch a live room for 5 minutes", reward: 50, progress: 3, goal: 5, href: "/live" },
  { id: "review", title: "Review something you bought", reward: 200, progress: 0, goal: 1, href: "/me" },
  { id: "follow", title: "Follow 3 factories", reward: 30, progress: 1, goal: 3, href: "/c" },
  { id: "share", title: "Share a product with a friend", reward: 20, progress: 0, goal: 1, href: "/" },
  { id: "invite", title: "Invite a friend who places an order", reward: 500, progress: 0, goal: 1, href: "/rewards" },
];

export const badges: Badge[] = [
  { id: "early", name: "Early bird", detail: "Joined in the first month", earned: true, icon: "sparkle" },
  { id: "solar", name: "Solar pioneer", detail: "Bought your first solar gear", earned: true, icon: "sun" },
  { id: "captain", name: "Team captain", detail: "Filled a team buy", earned: true, icon: "users" },
  { id: "owl", name: "Night owl", detail: "Caught 5 night deals", earned: false, icon: "clock" },
  { id: "bidder", name: "Hammer time", detail: "Won a live auction", earned: false, icon: "gavel" },
  { id: "globe", name: "Globetrotter", detail: "Shipped to 3 countries", earned: false, icon: "globe" },
];

export const rewardStore: RewardItem[] = [
  { id: "r-ship", title: "Free express shipping", cost: 800, couponId: "freeship" },
  { id: "r-5", title: "$5 off any order over $50", cost: 500, couponId: "welcome5" },
  { id: "r-25", title: "$25 off Voltgrid Power", cost: 2000, couponId: "voltgrid25" },
];

export const levels = [
  { name: "Bronze", from: 0 },
  { name: "Silver", from: 1000 },
  { name: "Gold", from: 2500 },
  { name: "Jade", from: 6000 },
];

/** Daily check-in rewards for days 1–7 of a streak. */
export const checkinRewards = [10, 10, 20, 20, 30, 30, 100];

export const boards: Board[] = [
  { id: "van-build", name: "Van build", owner: "You", ownerAvatar: "", slugs: ["power-station-2kwh", "balcony-solar-800w", "projector-mini-1080p", "lanterns-silk-set"] },
  { id: "dorm", name: "Dorm setup", owner: "You", ownerAvatar: "", slugs: ["projector-mini-1080p", "keyboard-75-retro", "lamp-brass-pendant", "earbuds-anc", "glass-tea-set"] },
  { id: "wedding", name: "Wedding looks", owner: "You", ownerAvatar: "", slugs: ["qipao-silk-made-to-measure", "hanfu-crimson", "jade-bangle-lantian", "miao-silver-headpiece"] },
  { id: "off-grid", name: "Off-grid in a weekend", owner: "Lin Outdoors", ownerAvatar: people.lin, slugs: ["wind-turbine-600w", "hybrid-inverter-6kw", "wall-battery-5kwh", "solar-panel-450w-bifacial"], followers: 12400 },
  { id: "fit-check", name: "Fit check essentials", owner: "Sora K.", ownerAvatar: people.sora, slugs: ["hoodie-heavyweight", "jacket-oversized-utility", "trainers-cloud-knit", "bag-sling-tech"], followers: 31800 },
  { id: "glow-up", name: "Glow-up under $30", owner: "Yan Beauty", ownerAvatar: avatar("1534751516642-a1af1ef26a56"), slugs: ["lip-set-velvet", "serum-niacinamide", "cream-ceramide", "serum-bakuchiol"], followers: 8700 },
];

/** Weekly creator earnings in USD, oldest first. */
export const creatorWeeks = [
  { week: "Sep 1", earned: 84 },
  { week: "Sep 8", earned: 112 },
  { week: "Sep 15", earned: 96 },
  { week: "Sep 22", earned: 148 },
  { week: "Sep 29", earned: 171 },
  { week: "Oct 6", earned: 205 },
  { week: "Oct 13", earned: 262 },
  { week: "Oct 20", earned: 307 },
];

export const creatorLinks: CreatorLink[] = [
  { slug: "power-station-2kwh", commission: 0.06, clicks: 4210, orders: 38, earned: 1366 },
  { slug: "hoodie-heavyweight", commission: 0.12, clicks: 3880, orders: 141, earned: 575 },
  { slug: "drone-mini-4k", commission: 0.08, clicks: 2950, orders: 52, earned: 911 },
  { slug: "lip-set-velvet", commission: 0.15, clicks: 1870, orders: 111, earned: 250 },
];

export const sampleOffers = ["projector-mini-1080p", "smartwatch-amoled", "bag-sling-tech", "serum-bakuchiol"];

export const businessRfqs: BusinessRfq[] = [
  {
    id: "RFQ-088",
    item: "Custom tote bags, debossed logo",
    qty: 1000,
    port: "Tema, Ghana",
    incoterm: "CIF",
    status: "quoting",
    quotes: [
      { sellerId: "baigou", unitPrice: 19.4, moq: 300, leadDays: 18, sample: 25, note: "Vegetable-tanned leather, logo die included" },
      { sellerId: "streetlab", unitPrice: 14.9, moq: 500, leadDays: 21, sample: 15, note: "Canvas with leather trim, screen-printed logo" },
      { sellerId: "yiwu", unitPrice: 9.8, moq: 1000, leadDays: 25, sample: 10, note: "Woven polypropylene, printed logo" },
    ],
  },
];
