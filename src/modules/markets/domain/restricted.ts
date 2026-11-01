/**
 * Destinations we don't sell to by default: countries under comprehensive or wide-ranging
 * sanctions. This is a starting point, not legal advice; RESTRICTED_COUNTRIES replaces it.
 */
export const DEFAULT_RESTRICTED = ["BY", "CU", "IR", "KP", "RU", "SY"] as const;

export const parseRestricted = (value: string | undefined): ReadonlySet<string> =>
  new Set((value === undefined ? DEFAULT_RESTRICTED.join(",") : value).split(",").map((c) => c.trim().toUpperCase()).filter(Boolean));
