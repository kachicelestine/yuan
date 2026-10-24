/**
 * The outcome of an operation that can fail in an expected way. Use it for business
 * failures (out of stock, invoice expired); throw only for bugs and outages.
 */
export type Result<T, E> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });

export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });

/** Unwraps a result whose failure would be a bug at this call site. */
export function expectOk<T, E>(result: Result<T, E>, context: string): T {
  if (result.ok) return result.value;
  throw new Error(`${context}: ${JSON.stringify(result.error)}`);
}
