// verse-compare — pure helpers (faithfully extracted from verse-compare.jsx).
// Isolated here so they can be tested in node without a DOM.
import type { Translation } from "./verse-compare-window.js";

/**
 * Faithful port of the initialIds useMemo:
 *   Array.from(new Set([primary, ...allTrans.map(t => t.id)])).slice(0, limit)
 *
 * Places primary first then deduplicates against the remaining translation ids,
 * capped at `limit` (default 12, matching the legacy constant).
 */
export function computeInitialIds(
  primary: string,
  allTrans: Translation[],
  limit = 12,
): string[] {
  return Array.from(new Set([primary, ...allTrans.map((t) => t.id)])).slice(0, limit);
}

/**
 * Faithful port of the addAdjacent state-setter body.
 *
 * Returns a new sorted verse-number array with `base + delta` inserted, where
 * base is the maximum verse (delta > 0) or minimum verse (delta < 0) currently
 * in the set. Returns the original array unchanged if the resulting verse
 * number would be < 1.
 */
export function addAdjacentVerse(verses: number[], delta: number): number[] {
  const all = new Set(verses);
  const base = delta > 0 ? Math.max(...verses) : Math.min(...verses);
  const next = base + delta;
  if (next < 1) return verses;
  all.add(next);
  return [...all].sort((a, b) => a - b);
}
