// Missions, badges and levels, all earned from what people actually do: orders placed,
// reviews written, chops finished, auctions won. Nothing here is a promise the shop
// can't keep: missions pay coins once, badges are recognition, levels follow coins earned.

/** What someone has done so far (each number from its own context). */
export type Activity = Readonly<{
  joinedAt: Date | null;
  orders: number;
  countries: number;
  /** Categories of everything they've paid for. */
  categories: readonly string[];
  reviews: number;
  saved: number;
  polls: number;
  chops: number;
  auctionsWon: number;
  /** Orders other people placed through their creator link. */
  referredOrders: number;
  commissionsEarned: number;
}>;

export const NO_ACTIVITY: Activity = { joinedAt: null, orders: 0, countries: 0, categories: [], reviews: 0, saved: 0, polls: 0, chops: 0, auctionsWon: 0, referredOrders: 0, commissionsEarned: 0 };

type Metric = Exclude<keyof Activity, "joinedAt" | "categories">;

export type Mission = Readonly<{ id: string; title: string; reward: number; goal: number; metric: Metric; href: string }>;

/** One-time missions; each pays its coins once, when claimed after the goal is reached. */
export const MISSIONS: readonly Mission[] = [
  { id: "first-order", title: "Place your first order", reward: 100, goal: 1, metric: "orders", href: "/" },
  { id: "review", title: "Review something you bought", reward: 200, goal: 1, metric: "reviews", href: "/me" },
  { id: "save-3", title: "Save 3 things you like", reward: 30, goal: 3, metric: "saved", href: "/discover" },
  { id: "poll", title: "Ask friends to pick between two products", reward: 20, goal: 1, metric: "polls", href: "/compare" },
  { id: "chop", title: "Chop a price with friends", reward: 50, goal: 1, metric: "chops", href: "/drops" },
  { id: "referral", title: "Bring in an order with your link", reward: 500, goal: 1, metric: "referredOrders", href: "/creator" },
];

export const missionProgress = (m: Mission, a: Activity) => Math.min(m.goal, a[m.metric]);

export type Badge = Readonly<{ id: string; name: string; detail: string; icon: string; earned: (a: Activity) => boolean }>;

/** The month the shop opened: anyone who joined before it ended is an early bird. */
export const EARLY_UNTIL = new Date("2026-12-01T00:00:00Z");

export const BADGES: readonly Badge[] = [
  { id: "early", name: "Early bird", detail: "Joined in the first month", icon: "sparkle", earned: (a) => a.joinedAt !== null && a.joinedAt < EARLY_UNTIL },
  { id: "solar", name: "Solar pioneer", detail: "Bought your first solar gear", icon: "sun", earned: (a) => a.categories.includes("energy") },
  { id: "chop", name: "Chop champion", detail: "Chopped a price with friends", icon: "scissors", earned: (a) => a.chops >= 1 },
  { id: "critic", name: "Trusted critic", detail: "Wrote 5 reviews", icon: "star", earned: (a) => a.reviews >= 5 },
  { id: "bidder", name: "Hammer time", detail: "Won a live auction", icon: "gavel", earned: (a) => a.auctionsWon >= 1 },
  { id: "globe", name: "Globetrotter", detail: "Shipped to 3 countries", icon: "globe", earned: (a) => a.countries >= 3 },
  { id: "creator", name: "Tastemaker", detail: "Earned your first commission", icon: "gift", earned: (a) => a.commissionsEarned >= 1 },
];

/** Levels by coins earned over time (spending coins never lowers a level). */
export const LEVELS = [
  { name: "Bronze", from: 0 },
  { name: "Silver", from: 1000 },
  { name: "Gold", from: 2500 },
  { name: "Jade", from: 6000 },
] as const;

export function levelOf(earned: number) {
  const index = LEVELS.findLastIndex((l) => earned >= l.from);
  const current = LEVELS[index];
  const next = LEVELS[index + 1] ?? null;
  return { name: current.name, next: next && { name: next.name, from: next.from }, progress: next ? (earned - current.from) / (next.from - current.from) : 1 };
}
