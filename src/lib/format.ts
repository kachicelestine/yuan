const usd = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
  minimumFractionDigits: 0,
});

export function money(amount: number) {
  return usd.format(Math.round(amount * 100) / 100);
}

const formatters = new Map<string, Intl.NumberFormat>();

/** Formats an amount already converted into `currency`. Big-unit currencies drop decimals. */
export function formatMoney(amount: number, currency: string) {
  let format = formatters.get(currency);
  if (!format) {
    // A bare "$" would be ambiguous for these, so they keep their prefix (MX$, CA$, A$).
    const display = ["MXN", "CAD", "AUD"].includes(currency) ? "symbol" : "narrowSymbol";
    const cents = ["USD", "EUR", "GBP", "AUD", "CAD", "AED"].includes(currency);
    // Whole amounts drop the cents ($34); anything else keeps both digits ($11.20, never $11.2).
    format = new Intl.NumberFormat("en-US", { style: "currency", currency, currencyDisplay: display, maximumFractionDigits: cents ? 2 : 0, minimumFractionDigits: cents ? 2 : 0, trailingZeroDisplay: "stripIfInteger" });
    formatters.set(currency, format);
  }
  return format.format(amount);
}

export function compact(n: number) {
  if (n < 1000) return String(n);
  if (n < 10_000) return n.toLocaleString("en-US");
  const k = n / 1000;
  return `${k >= 100 ? Math.round(k) : k.toFixed(1).replace(/\.0$/, "")}K`;
}

export function clock(totalSeconds: number) {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${String(h).padStart(2, "0")}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** "1 product", "7 products", "1,204 comments". */
export function plural(n: number, one: string, many = `${one}s`) {
  return `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;
}


/** Rounds a local amount to something a person would print on a coupon (£3.50, ₦66,000). */
export function niceAmount(n: number) {
  if (n < 10) return Math.round(n * 2) / 2;
  if (n < 100) return Math.round(n);
  if (n < 1000) return Math.round(n / 5) * 5;
  const step = 10 ** (Math.floor(Math.log10(n)) - 1);
  return Math.round(n / step) * step;
}

/** The next clean axis maximum: 1, 2, 2.5 or 5 times a power of ten. */
export function niceCeil(n: number) {
  const step = 10 ** Math.floor(Math.log10(n));
  const f = n / step;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * step;
}
