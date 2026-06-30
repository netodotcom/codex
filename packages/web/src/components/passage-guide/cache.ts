// passage-guide — localStorage cache (migrated verbatim from passage-guide.jsx).
// One entry per chapter at codex.passage-guide.{book}.{chapter}, language-
// suffixed for non-English readers. Reads window.CODEX_LANG through the boundary.
import { pgw } from "./passage-guide-window.js";
import type { Guide } from "./json.js";

export const CACHE_PREFIX = "codex.passage-guide.";

export function cacheKey(bookId: string, chapter: number | undefined): string {
  const lang = pgw().CODEX_LANG || "en";
  const suffix = lang === "en" ? "" : "." + lang;
  return `${CACHE_PREFIX}${bookId}.${chapter}${suffix}`;
}

export function getCached(bookId: string, chapter: number | undefined): Guide | null {
  try {
    const raw = localStorage.getItem(cacheKey(bookId, chapter));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { _v?: number; data?: Guide } | null;
    if (parsed && parsed._v === 1 && parsed.data) return parsed.data;
    return null;
  } catch {
    return null;
  }
}

export function putCached(bookId: string, chapter: number | undefined, data: Guide): void {
  try {
    localStorage.setItem(cacheKey(bookId, chapter), JSON.stringify({ _v: 1, data, fetchedAt: Date.now() }));
  } catch {
    /* ignore quota / serialization errors */
  }
}
