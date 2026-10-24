/** Words shoppers type that never narrow a search. */
const STOPWORDS = new Set("a an and any best cheap find for good i in me my need of please show some something that the to want with".split(" "));

/** The word plus its likely singulars, so synonym lookups work for "batteries" and "bags". */
function forms(word: string) {
  const out = [word];
  if (word.length > 3 && word.endsWith("s") && !word.endsWith("ss")) {
    out.push(word.slice(0, -1));
    if (word.endsWith("ies")) out.push(`${word.slice(0, -3)}y`);
    if (/(ch|sh|x)es$/.test(word)) out.push(word.slice(0, -2));
  }
  return out;
}

const lexemes = (phrase: string) => phrase.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);

/** The words of a search that narrow it, lower-cased (e.g. to match tags exactly). */
export const searchWords = (text: string) => lexemes(text).filter((w) => !STOPWORDS.has(w));

/**
 * Builds a Postgres `to_tsquery` string from free text:
 * every word must match (&), a word's synonyms widen it (|), multi-word synonyms
 * match as phrases (<->), and the last word matches as a prefix so results appear
 * while the shopper is still typing. Output contains only [a-z0-9] lexemes and
 * operators, and is always sent as a bound parameter.
 */
export function toTsQuery(text: string, synonyms: Readonly<Record<string, readonly string[]>> = {}): string | null {
  const words = searchWords(text);
  if (!words.length) return null;
  return words
    .map((word, i) => {
      const last = i === words.length - 1;
      const alternatives = new Set(forms(word).flatMap((f) => [f, ...(synonyms[f] ?? [])]));
      const terms = [...alternatives].map((alt) => {
        const parts = lexemes(alt);
        if (parts.length > 1) return parts.join(" <-> ");
        return last ? `${parts[0]}:*` : parts[0];
      });
      return `(${[...new Set(terms)].join(" | ")})`;
    })
    .join(" & ");
}
