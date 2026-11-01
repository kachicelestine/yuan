type Candidate = { code: string; timeZone: string };

/**
 * A first guess at a new visitor's country from what the browser already knows, used until
 * the server's answer arrives (or when it has none). The time zone comes first: plenty of
 * phones are set to en-US outside the US, but few keep another country's clock.
 */
export function guessMarket(markets: readonly Candidate[], timeZone: string | undefined, languages: readonly string[]): string | null {
  const byZone = timeZone ? markets.find((m) => m.timeZone === timeZone) : undefined;
  if (byZone) return byZone.code;
  for (const language of languages) {
    const region = language.split("-").find((part, i) => i > 0 && part.length === 2)?.toUpperCase();
    if (region && markets.some((m) => m.code === region)) return region;
  }
  return null;
}
