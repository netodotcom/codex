// library2 — typed window boundary (migrated from library2.jsx).
// Reads:  CODEX_DATA, CODEX_NOW, CODEX_SEARCH, t, codexGoto, codexJumpToRef,
//         CODEX_PLUGINS_API.
// Sets:   LibraryX (the frozen export contract, same name as legacy).
// Standard browser globals (window, document, CustomEvent, setTimeout,
// clearTimeout) keep their lib.dom typings and are used directly.

// ── Bible data shapes ─────────────────────────────────────────────────────────
export interface Lib2Translation {
  id?: string;
  canons?: string[];
}

export interface Lib2Book {
  id: string;
  name: string;
  testament: string;   // "OT" | "NT" | "DC"
  canon?: string;      // DC books carry the specific canon key
  chapters: number;
}

export interface Lib2Data {
  books: Lib2Book[];
  translations: Lib2Translation[];
  tweaks?: { primaryTranslation?: string };
}

export interface Lib2Now {
  bookId?: string;
  chapter?: number;
}

// ── Search API ────────────────────────────────────────────────────────────────
export interface Lib2SearchResult {
  ref?: string;
  snippet?: string;
  text?: string;
}

export interface Lib2Search {
  search(
    query: string,
    opts: { translation: string; limit: number },
  ): Promise<Lib2SearchResult[]>;
}

// ── Plugin API ────────────────────────────────────────────────────────────────
export interface Lib2PluginsApi {
  register(plugin: unknown): unknown;
}

// ── The window ────────────────────────────────────────────────────────────────
export interface Library2Window {
  CODEX_DATA?: Lib2Data;
  CODEX_NOW?: Lib2Now;
  CODEX_SEARCH?: Lib2Search;
  t?: (k: string) => string;
  codexGoto?: (bookId: string, ch: number, v: number) => void;
  codexJumpToRef?: (ref: string) => void;
  CODEX_PLUGINS_API?: Lib2PluginsApi;
  /** Set at module load — the frozen export contract (same name as v1). */
  LibraryX?: unknown;
}

export function lw(): Library2Window {
  return window as unknown as Library2Window;
}
