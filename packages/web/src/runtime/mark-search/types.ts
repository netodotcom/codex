// mark-search — shared types for the MarkSearch engine.

// Shape of a saved mark (from app.jsx comments in legacy/mark-search.js).
export interface Mark {
  key: string;
  ref: string;
  color: string;
  note?: string | undefined;
  text?: string | undefined;
  ts: number;
  pinned?: boolean | undefined;
}

export interface RankResult {
  key: string;
  reason: string;
}

// Persistent cache entry stored under CACHE_KEY in localStorage.
export interface CacheEntry {
  ts: number;
  results: RankResult[];
}

export type CacheStore = Record<string, CacheEntry>;
