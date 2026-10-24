// The shopping agent's brain for the design phase: intent rules over the real catalog.
// The production agent will be a model with tools (search, landed cost, bag, watch, RFQ);
// the blocks it returns, and the rule that spending needs approval, stay the same.
import { products } from "@/fixtures/products";
import { profiles } from "@/fixtures/profiles";
import { sellers } from "@/fixtures/sellers";
import { landedCost, shiftDelivery } from "./landed";
import { searchProducts, searchSellers, understand } from "./search";
import type { Market, Product } from "./types";

export type AgentAction =
  | { type: "add-to-bag"; lines: { slug: string; qty: number }[] }
  | { type: "watch"; slug: string; target: number; autoBuy: boolean }
  | { type: "rfq"; sellerIds: string[]; item: string; qty: number };

export type AgentBlock =
  | { kind: "text"; text: string }
  | { kind: "steps"; steps: string[] }
  | { kind: "products"; slugs: string[] }
  | { kind: "compare"; slugs: string[]; rows: { label: string; values: string[]; best?: number }[] }
  | { kind: "landed"; slug: string; qty: number }
  | { kind: "kit"; lines: { slug: string; qty: number; why: string }[] }
  | { kind: "action"; id: string; label: string; detail: string; action: AgentAction };

export const agentSuggestions = [
  "Power my 2-bedroom flat through blackouts",
  "Compare the mini drone and the projector",
  "Duties on 20 hoodies to my country?",
  "Buy the power station if it drops under $540",
  "Get quotes for 300 custom tote bags",
];

const get = (slug: string) => products.find((p) => p.slug === slug)!;
const qtyIn = (text: string) => Number(/(\d[\d,]*)\s*(?:x\b|pcs|pieces|units|sets|of)?/i.exec(text)?.[1]?.replace(/,/g, "") ?? 0);
const has = (text: string, ...words: string[]) => words.some((w) => text.includes(w));
/** A spoken amount in USD: named currency, else the shopper's own. */
const toUsd = (a: { amount: number; currency?: string }, market: Market, markets: Market[]) =>
  a.amount / (markets.find((m) => m.currency === (a.currency ?? market.currency))?.rate ?? market.rate);
let counter = 0;
const nextId = () => `a${++counter}`;

/** Turns one message into the agent's reply, priced for the shopper's market. */
export function respond(input: string, market: Market, money: (usd: number) => string, markets: Market[] = [market]): AgentBlock[] {
  const text = input.toLowerCase();

  // 1. Power and solar: size a kit from real listings.
  if (has(text, "solar", "blackout", "power cut", "outage", "backup power", "off-grid", "generator", "power my")) {
    const lines = [
      { slug: "solar-panel-450w-bifacial", qty: 6, why: "2.7 kW of panels covers about 8 kWh a day in strong sun" },
      { slug: "hybrid-inverter-6kw", qty: 1, why: "Runs solar, battery and grid together, switches in under 10 ms" },
      { slug: "wall-battery-5kwh", qty: 1, why: "Keeps the fridge, lights, fans and Wi-Fi on through the night" },
    ];
    const item = lines.reduce((n, l) => n + (get(l.slug).price ?? 0) * l.qty, 0);
    const landed = landedCost(item, 0.05, market);
    const ships = lines.every((l) => profiles[get(l.slug).sellerId]?.exportsTo.includes(market.code));
    return [
      { kind: "steps", steps: ["Estimating a 2-bedroom home's daily use", "Matching panels, inverter and battery from audited factories", `Pricing it all delivered to ${market.city}`] },
      {
        kind: "text",
        text: `For a 2-bedroom flat running a fridge, lights, fans, a TV and Wi-Fi, plan on about 8 kWh a day. This kit comes from two audited factories and lands at ${money(landed.total)} in ${market.name}, duties and ${market.vatLabel} included.${ships ? "" : " One of the factories is new to your country, so it ships with extra tracking."}`,
      },
      { kind: "kit", lines },
      { kind: "action", id: nextId(), label: `Add the kit to your bag`, detail: `${lines.length} items · ${money(item)} before duties`, action: { type: "add-to-bag", lines: lines.map(({ slug, qty }) => ({ slug, qty })) } },
      { kind: "text", text: "Want me to swap in the 800 W balcony kit instead? It plugs into a wall socket, so it suits renters." },
    ];
  }

  // 2. Price watch and auto-buy.
  const said = understand(input);
  if (has(text, "drops", "watch", "alert", "cheaper", "auto-buy", "autobuy", "if it") || (said.max && has(text, "buy"))) {
    const found = searchProducts(said.text.replace(/\b(buy|the|if|it|drops|watch|alert|me|when)\b/gi, " "))[0] ?? get("power-station-2kwh");
    const target = said.max ? toUsd(said.max, market, markets) : (found.price ?? 0) * 0.9;
    const low = Math.min(...[found.price ?? 0, found.was ?? Infinity]);
    return [
      { kind: "steps", steps: [`Found “${found.title}”`, "Reading 90 days of price history", "Setting a watch you control"] },
      {
        kind: "text",
        text: `It's ${money(found.price ?? 0)} today${found.was ? `, down from ${money(found.was)}` : ""}. Over the last 90 days it has dipped about 7% in flash sales, so ${money(target)} is ${target < low * 0.85 ? "ambitious but possible during a big sale" : "realistic"}. I'll buy it the moment it gets there, and you'll have 24 hours to cancel.`,
      },
      { kind: "products", slugs: [found.slug] },
      { kind: "action", id: nextId(), label: `Auto-buy at ${money(target)}`, detail: "Uses your saved payment · 24 h to cancel", action: { type: "watch", slug: found.slug, target, autoBuy: true } },
    ];
  }

  // 3. Duties and landed cost.
  if (has(text, "duty", "duties", "tax", "customs", "landed", "import")) {
    const qty = qtyIn(text) || 1;
    const found = searchProducts(text.replace(/\b(duty|duties|tax|taxes|customs|landed|import|on|to|my|country|what|will|i|pay|for|\d+)\b/g, " "))[0] ?? get("hoodie-heavyweight");
    return [
      { kind: "steps", steps: [`Found “${found.title}”`, `Looking up import rules for ${market.name}`, "Working out shipping, duty and tax"] },
      {
        kind: "text",
        text: `For ${qty} × ${found.title.toLowerCase()} delivered to ${market.city}, here's everything you'd pay. Pay it all at checkout and nothing is due at the door.`,
      },
      { kind: "landed", slug: found.slug, qty },
    ];
  }

  // 4. Quotes from factories (RFQ).
  if (has(text, "quote", "rfq", "bulk", "wholesale", "custom", "logo", "factories", "factory", "find me")) {
    const qty = qtyIn(text) || 500;
    const item = understand(input).text.replace(/\b(get|me|quotes?|for|from|find|factories|factory|custom|bulk|wholesale|with|my|logo|\d+)\b/gi, " ").replace(/\s+/g, " ").trim() || "your product";
    const matches = searchSellers(item).slice(0, 3);
    const picks = (matches.length ? matches : Object.values(sellers).filter((s) => s.kind === "Factory").slice(0, 3)).map((s) => s.id);
    return [
      { kind: "steps", steps: [`Finding factories that make ${item}`, "Checking audits, capacity and response times", "Drafting one request for all of them"] },
      {
        kind: "text",
        text: `I found ${picks.length} audited ${picks.length === 1 ? "factory" : "factories"} for ${qty.toLocaleString("en-US")} × ${item}. I'll send them one request with your quantity, logo note and ${market.name} delivery, then line the quotes up side by side. They usually reply within ${Math.max(...picks.map((id) => profiles[id]?.responseHours ?? 4))} hours.`,
      },
      { kind: "action", id: nextId(), label: `Send the request to ${picks.length} ${picks.length === 1 ? "factory" : "factories"}`, detail: picks.map((id) => sellers[id]?.name).join(" · "), action: { type: "rfq", sellerIds: picks, item, qty } },
    ];
  }

  // 5. Comparisons.
  if (has(text, "compare", " vs", "versus", "which is better", " or the ")) {
    const parts = text.replace(/compare|which is better|versus/g, " ").split(/\bvs\.?\b|\band\b|\bor\b|,/).map((s) => s.trim()).filter(Boolean);
    const picks = [...new Set(parts.map((p) => searchProducts(p)[0]?.slug).filter(Boolean) as string[])].slice(0, 3);
    const slugs = picks.length >= 2 ? picks : ["drone-mini-4k", "projector-mini-1080p"];
    const list = slugs.map(get);
    const priceBest = list.reduce((b, p, i) => ((p.price ?? Infinity) < (list[b].price ?? Infinity) ? i : b), 0);
    const ratingBest = list.reduce((b, p, i) => (p.rating > list[b].rating ? i : b), 0);
    return [
      { kind: "steps", steps: [`Comparing ${list.length} products`, "Reading reviews and specs", `Pricing delivery to ${market.city}`] },
      {
        kind: "compare",
        slugs,
        rows: [
          { label: "Price", values: list.map((p) => (p.price ? money(p.price) : "Quote")), best: priceBest },
          { label: "Rating", values: list.map((p) => `★ ${p.rating} (${p.reviews.toLocaleString("en-US")})`), best: ratingBest },
          { label: "Arrives", values: list.map((p) => shiftDelivery(p.delivery, market.extraDays)) },
          { label: "Best for", values: list.map((p) => p.highlights[0]) },
          { label: "Watch out", values: list.map((p) => watchOut(p)) },
        ],
      },
      { kind: "text", text: `${list[ratingBest].title} has the happiest buyers; ${list[priceBest].title} costs least. Tell me how you'll use it and I'll pick one.` },
    ];
  }

  // 6. Anything else: search, explained.
  const found = searchProducts(said.text || input, said.max ? { maxPrice: toUsd(said.max, market, markets) } : {}).slice(0, 4);
  if (found.length) {
    return [
      { kind: "steps", steps: [`Searching ${products.length} listings from ${Object.keys(sellers).length} verified sellers`, "Ranking by fit, reviews and delivery"] },
      { kind: "text", text: `Here's what fits best. ${found[0].title} is the strongest match: ★ ${found[0].rating} from ${found[0].reviews.toLocaleString("en-US")} buyers.` },
      { kind: "products", slugs: found.map((p) => p.slug) },
    ];
  }
  return [
    { kind: "text", text: "Nobody on the platform lists that yet, but factories often make things they don't list. Want me to ask a few?" },
    { kind: "action", id: nextId(), label: "Ask 3 factories to quote", detail: "Free · replies within a day", action: { type: "rfq", sellerIds: ["makerworks", "baigou", "yiwu"], item: input, qty: 100 } },
  ];
}

function watchOut(p: Product) {
  const words = p.buyersSay?.split(/(?<=\.)\s/) ?? [];
  const caveat = words.find((s) => /\b(but|heavy|wish|a few|light-duty|longer|noisy|loud|needs a)\b/i.test(s));
  if (!caveat) return "Nothing buyers flag";
  const text = caveat.replace(/^(Buyers|Owners|Renters|Installers) (say|love that) /, "");
  return text[0].toUpperCase() + text.slice(1);
}

