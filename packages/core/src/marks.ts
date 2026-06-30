// Mark-search pure helpers — ported from mark-search.js.
//
// The Oracle call + localStorage cache are platform glue (deferred); the pure,
// testable core is: a cache signature, a mark preview line, tolerant parsing of
// the model's JSON answer, and LRU pruning.

export interface Mark {
  key: string;
  ref?: string;
  color?: string;
  note?: string;
  text?: string;
  ts?: number;
  pinned?: boolean;
}

export interface RankResult {
  key: string;
  reason: string;
}

/** Cache signature = normalized query + count + sorted keys. */
export function markSignature(query: string, marks: Mark[]): string {
  const norm = (query || "").trim().toLowerCase();
  const keys = marks
    .map((m) => m.key)
    .sort()
    .join(",");
  return `${norm}||${marks.length}||${keys}`;
}

export function previewMark(m: Mark, i: number): string {
  const ref = m.ref || "?";
  const col = m.color || "?";
  const note = m.note ? ` · note:"${String(m.note).slice(0, 90)}"` : "";
  const text = m.text ? ` · text:"${String(m.text).slice(0, 110)}"` : "";
  return `${i + 1}. [${m.key}] ${ref} · ${col}${note}${text}`;
}

function isRankCandidate(x: unknown): x is { key: string; reason?: unknown } {
  return !!x && typeof x === "object" && typeof (x as { key?: unknown }).key === "string";
}

/**
 * Extract the ranked array from a model reply that may include code fences or
 * leading prose. Drops keys not present in `marks` and caps at 12 results.
 */
export function parseRankResults(text: string, marks: Mark[]): RankResult[] {
  const match = String(text || "")
    .trim()
    .match(/\[[\s\S]*\]/);
  if (!match) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const validKeys = new Set(marks.map((m) => m.key));
  return parsed
    .filter(isRankCandidate)
    .filter((x) => validKeys.has(x.key))
    .slice(0, 12)
    .map((x) => ({ key: x.key, reason: String(x.reason ?? "").slice(0, 140) }));
}

/** Evict oldest-by-ts entries until `cache` holds at most `max`. Mutates + returns. */
export function pruneCache<T extends { ts?: number }>(cache: Record<string, T>, max: number): Record<string, T> {
  const keys = Object.keys(cache);
  if (keys.length <= max) return cache;
  const sorted = keys
    .map((k) => [k, cache[k]?.ts ?? 0] as const)
    .sort((a, b) => a[1] - b[1]);
  const drop = sorted.slice(0, sorted.length - max);
  for (const [k] of drop) delete cache[k];
  return cache;
}
