// Fixture data for the design phase: one shopper's account (rewards,
// coupons, boards and creator earnings).
import { avatar } from "@/lib/images";
import type { Board, Coupon, RewardItem } from "@/lib/types";
import { people } from "./people";

export const coupons: Coupon[] = [
  { id: "welcome5", title: "$5 off", detail: "Your first order over $50", value: 5, minSpend: 50, expires: "Nov 30" },
  { id: "freeship", title: "Free express", detail: "Air shipping on orders over $80", value: 18, freeShipping: true, minSpend: 80, expires: "Nov 15" },
  { id: "sunvolt10", title: "10% off", detail: "Sunvolt Energy, orders over $200", value: 0.1, percent: true, minSpend: 200, sellerId: "sunvolt", expires: "Nov 8" },
  { id: "glow3", title: "$3 off", detail: "Glow Lab, orders over $20", value: 3, minSpend: 20, sellerId: "glowlab", expires: "Oct 31" },
  { id: "voltgrid25", title: "$25 off", detail: "Voltgrid Power, orders over $500", value: 25, minSpend: 500, sellerId: "voltgrid", expires: "Nov 12" },
  { id: "street8", title: "8% off", detail: "Canton Street Lab, 2+ items", value: 0.08, percent: true, minSpend: 60, sellerId: "streetlab", expires: "Nov 20" },
];

export const rewardStore: RewardItem[] = [
  { id: "r-ship", title: "Free express shipping", cost: 800, couponId: "freeship" },
  { id: "r-5", title: "$5 off any order over $50", cost: 500, couponId: "welcome5" },
  { id: "r-25", title: "$25 off Voltgrid Power", cost: 2000, couponId: "voltgrid25" },
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

export const sampleOffers = ["projector-mini-1080p", "smartwatch-amoled", "bag-sling-tech", "serum-bakuchiol"];
