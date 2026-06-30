// auto-cache — typed window boundary. All runtime global accesses go through
// acw() so the rest of the code never touches `window as any`.
// Mirrors the pattern established in modules-window.ts / mark-search-window.ts.
import type { AutoCacheApi, BibleEngine, CodexDataSlice } from "./types.js";

// ── Window globals this module SETS ──────────────────────────────────────────
//   window.CODEX_AUTOCACHE  — the public API (state / reset / runNow).

// ── Window globals this module READS ─────────────────────────────────────────
//   window.BIBLE      — verse-loader engine (not yet migrated from legacy/).
//                       Consumed as BibleEngine: downloadAll + cacheStats.
//   window.CODEX_DATA — static bible data written by app.jsx.
//                       Consumed as CodexDataSlice: { books }.

export interface AutoCacheWindow {
  CODEX_AUTOCACHE?: AutoCacheApi | undefined;
  BIBLE?: BibleEngine | undefined;
  CODEX_DATA?: CodexDataSlice | undefined;
}

export function acw(): AutoCacheWindow {
  return window as unknown as AutoCacheWindow;
}
