// bible — typed window boundary. All runtime global accesses go through
// bw() so the rest of the code never touches `window as any`.
// Mirrors the pattern established in modules-window.ts / data-window.ts.
import type { BibleApi } from "./types.js";
import type { BibleCodexDataSlice } from "./types.js";

// ── Window globals this module SETS ──────────────────────────────────────────
//   window.BIBLE — the scripture loader API (see BibleApi in types.ts)
//
// ── Window globals this module READS ─────────────────────────────────────────
//   window.CODEX_DATA.translations — array of TranslationEntry; only the
//     subset of fields relevant to the bible loader is typed here via
//     BibleCodexDataSlice (the full shape lives in data/types.ts).
//   fetch        — standard Browser API (no custom global slice needed)
//   indexedDB    — standard Browser API (typed via DOM lib)
//   localStorage — standard Browser API (typed via DOM lib)
//   navigator.storage.estimate — standard Browser API
export interface BibleWindow {
  BIBLE?: BibleApi;
  CODEX_DATA?: BibleCodexDataSlice;
}

export function bw(): BibleWindow {
  return window as unknown as BibleWindow;
}
