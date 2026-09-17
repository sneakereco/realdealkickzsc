export type ProductSearchCandidate = {
  id: string;
  brand: string | null;
  name: string | null;
  model: string | null;
  skus: string[];
};

export function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function buildSearchTerms(input?: string): string[] {
  const normalized = normalizeSearchText(input ?? "");
  if (!normalized) return [];

  const terms = new Set<string>([normalized]);
  for (const token of normalized.split(" ")) {
    if (token.length < 2) continue;
    terms.add(token);
    if (token.endsWith("ies") && token.length > 4) terms.add(`${token.slice(0, -3)}y`);
    else if (token.endsWith("es") && token.length > 4) terms.add(token.slice(0, -2));
    else if (token.endsWith("s") && token.length > 3) terms.add(token.slice(0, -1));
  }
  return [...terms].slice(0, 8);
}

function fieldScore(
  value: string,
  query: string,
  tokens: string[],
  weight: number,
): number {
  const normalized = normalizeSearchText(value);
  if (!normalized) return 0;
  if (normalized === query) return 10_000 + weight;
  if (normalized.startsWith(query)) return 8_000 + weight;
  if (normalized.includes(query)) return 6_000 + weight;

  const matched = tokens.filter((token) => normalized.includes(token)).length;
  if (matched === tokens.length) return 4_000 + weight;
  return matched ? matched * 100 + weight : 0;
}

export function rankSearchCandidates<T extends ProductSearchCandidate>(
  candidates: T[],
  input?: string,
): T[] {
  const query = normalizeSearchText(input ?? "");
  if (!query) return candidates;
  const tokens = buildSearchTerms(input).filter((term) => term !== query);
  const meaningfulTokens = tokens.length ? tokens : [query];

  return candidates
    .map((candidate) => ({
      candidate,
      score: Math.max(
        fieldScore(candidate.brand ?? "", query, meaningfulTokens, 10),
        fieldScore(candidate.name ?? "", query, meaningfulTokens, 40),
        fieldScore(candidate.model ?? "", query, meaningfulTokens, 30),
        ...candidate.skus.map((sku) => fieldScore(sku, query, meaningfulTokens, 50)),
      ),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.candidate.id.localeCompare(b.candidate.id))
    .map(({ candidate }) => candidate);
}
