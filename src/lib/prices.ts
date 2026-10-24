// Price history for the fixtures: a stable, believable 90-day walk that ends at today's price.
import type { Product } from "./types";

export type PricePoint = { date: string; price: number };

const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const today = Date.UTC(2026, 9, 23);

function noise(slug: string, day: number) {
  let h = 7 + day * 131;
  for (const ch of slug) h = (h * 33 + ch.charCodeAt(0)) % 10007;
  return h / 10007;
}

export function priceHistory(product: Product, days = 90): PricePoint[] {
  const now = product.price ?? 0;
  const start = product.was ?? now * 1.08;
  return Array.from({ length: days }, (_, d) => {
    const t = d / (days - 1);
    const eased = t * t * (3 - 2 * t);
    let price = start + (now - start) * eased + (noise(product.slug, d) - 0.5) * now * 0.04;
    // The odd flash sale.
    if (noise(product.slug, d * 7 + 3) > 0.965) price *= 0.93;
    if (d === days - 1) price = now;
    const date = new Date(today - (days - 1 - d) * 86_400_000);
    return { date: `${months[date.getUTCMonth()]} ${date.getUTCDate()}`, price: Math.round(price * 100) / 100 };
  });
}

