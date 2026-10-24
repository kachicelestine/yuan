/** The current time, injected so time-dependent rules (delivery dates, expiries) are testable. */
export type Clock = { now(): Date };

export const systemClock: Clock = { now: () => new Date() };

export const fixedClock = (iso: string): Clock => ({ now: () => new Date(iso) });
