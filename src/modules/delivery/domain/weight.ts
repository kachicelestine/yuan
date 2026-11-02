// Carriers charge by weight. A listing's weight comes from its "Weight" spec when the shop
// gave one, otherwise from a typical weight for its category, plus packaging.

/** Typical packed weight of one item in each category, in grams. */
export const CATEGORY_GRAMS: Readonly<Record<string, number>> = {
  energy: 8_000,
  mobility: 15_000,
  electronics: 600,
  smarthome: 500,
  fashion: 450,
  bags: 700,
  jewelry: 100,
  textiles: 600,
  beauty: 300,
  home: 1_200,
  tea: 300,
  toys: 500,
};

export const FALLBACK_GRAMS = 500;

const UNITS: Record<string, number> = { g: 1, gram: 1, grams: 1, kg: 1000, kgs: 1000, kilogram: 1000, kilograms: 1000, lb: 453.6, lbs: 453.6, pound: 453.6, pounds: 453.6, oz: 28.35, ounce: 28.35, ounces: 28.35 };

/** Grams from text like "380 g", "1.2 kg" or "2 lb"; null when it isn't a weight. */
export function parseWeight(text: string): number | null {
  const m = /^\s*(\d+(?:[.,]\d+)?)\s*([a-z]+)\b/i.exec(text);
  const unit = m && UNITS[m[2].toLowerCase()];
  if (!m || !unit) return null;
  const grams = Number(m[1].replace(",", ".")) * unit;
  return grams > 0 && grams < 1_000_000 ? Math.round(grams) : null;
}

/** The weight a carrier will charge for one item: its own or its category's, plus packaging. */
export function shippingGrams(product: { category: string; specs: readonly (readonly [string, string])[] }): number {
  const spec = product.specs.find(([k]) => /^(shipping |packed |net |gross )?weight$/i.test(k.trim()));
  const own = spec ? parseWeight(spec[1]) : null;
  const grams = own ?? CATEGORY_GRAMS[product.category] ?? FALLBACK_GRAMS;
  return Math.round(grams * 1.1 + 50);
}
