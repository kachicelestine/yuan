/**
 * Money is a whole number of US cents. Buyers pay in dollar stablecoins, so USD is the
 * unit of account everywhere; local currencies are converted only for display.
 * Integer cents keep sums exact (no 0.1 + 0.2 drift).
 */
export type Cents = number & { readonly __unit: "USD cents" };

export function cents(value: number): Cents {
  if (!Number.isSafeInteger(value)) throw new RangeError(`Cents must be a safe integer, got ${value}`);
  return value as Cents;
}

/** From a dollar amount such as 12.99, rounding half away from zero to the nearest cent. */
export const fromDollars = (dollars: number): Cents => cents(Math.sign(dollars) * Math.round(Math.abs(dollars) * 100));

export const toDollars = (amount: Cents) => amount / 100;

export const ZERO = cents(0);

export const add = (...amounts: Cents[]): Cents => cents(amounts.reduce((sum, a) => sum + a, 0));

export const subtract = (a: Cents, b: Cents): Cents => cents(a - b);

export const times = (amount: Cents, quantity: number): Cents => cents(Math.round(amount * quantity));

/** A rate such as 0.075 (7.5% VAT) applied to an amount, rounded to the nearest cent. */
export const percentOf = (amount: Cents, rate: number): Cents => cents(Math.round(amount * rate));

export const max = (a: Cents, b: Cents): Cents => (a > b ? a : b);
