// search — typed window boundary. All runtime global accesses go through
// sw() so the rest of the code never touches `window as any`.
// Mirrors the pattern established in gematria-window.ts / mark-search-window.ts.
import type { CodexSearchApi, BookRecord, SearchBarProps } from "./types.js";

// ── Window globals this feature READS ────────────────────────────────────────

/** Minimal BIBLE slice this engine consumes (seed guard via _seeded flag). */
export interface SearchWindowBible {
  ready?: Promise<unknown> | undefined;
}

/** Minimal CODEX_DATA slice: only .books is needed for pretty-printing refs. */
export interface SearchWindowCodexData {
  books?: BookRecord[] | undefined;
}

// ── Window globals this feature SETS + READS ─────────────────────────────────
export interface SearchWindow {
  // Globals this module SETS
  CODEX_SEARCH?: CodexSearchApi | undefined;
  CODEX_SearchBar?: ((props: SearchBarProps) => unknown) | undefined;

  // Globals this module READS
  BIBLE?: SearchWindowBible | undefined;
  CODEX_DATA?: SearchWindowCodexData | undefined;
  /** Returns the current UI language name (e.g. "English", "Português"). */
  codexLangName?: (() => string) | undefined;
  /** Engagement tracker — optional, absent in offline-only builds. */
  CODEX_ENGAGE?: { trackSearch(): void } | undefined;

  // IndexedDB may be absent in SSR / minimal test environments
  indexedDB?: IDBFactory | undefined;
}

export function sw(): SearchWindow {
  return window as unknown as SearchWindow;
}
