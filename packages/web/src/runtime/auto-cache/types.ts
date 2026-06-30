// auto-cache — shared TypeScript types.

/** Shape stored in localStorage["codex.autocache.v1"]. */
export interface AutoCacheFlag {
  done: string[];
  at: number;
}

/** Public API surface exposed on window.CODEX_AUTOCACHE. */
export interface AutoCacheApi {
  /** Returns the current localStorage flag (which translations are done). */
  state(): AutoCacheFlag;
  /** Removes the flag from localStorage so the next load re-runs the warm-up. */
  reset(): void;
  /** Manually trigger the warm-up and return the running promise. */
  runNow(): Promise<void>;
}

/** Return value of window.BIBLE.cacheStats(). */
export interface CacheStats {
  fully: boolean;
  cached?: number | undefined;
  total?: number | undefined;
}

/** One book entry from window.CODEX_DATA.books. */
export interface BibleBook {
  chapters?: number | undefined;
  [key: string]: unknown;
}

/** Shape passed to the onProgress callback by window.BIBLE.downloadAll(). */
export interface ProgressInfo {
  done?: number | undefined;
  completed?: number | undefined;
  [key: string]: unknown;
}

/**
 * Minimal slice of window.BIBLE that auto-cache consumes.
 *
 * downloadAll's return type is intentionally `unknown` — the legacy code
 * branches at runtime on .then / .done.then / poll fallback, so we narrow
 * with type guards inside helpers.ts rather than constraining the contract.
 */
export interface BibleEngine {
  downloadAll(
    translation: string,
    books: BibleBook[],
    onProgress: (info: ProgressInfo) => void,
  ): unknown;
  cacheStats(
    translation: string,
    books: BibleBook[],
  ): CacheStats | null | undefined;
}

/** Minimal slice of window.CODEX_DATA that auto-cache consumes. */
export interface CodexDataSlice {
  books: BibleBook[];
}
