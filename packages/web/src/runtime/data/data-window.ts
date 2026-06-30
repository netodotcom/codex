// data — typed window boundary. All runtime global accesses go through
// dw() so the rest of the code never touches `window as any`.
// Mirrors the pattern established in modules-window.ts / gematria-window.ts.
import type { CodexData } from "./types.js";

// ── Window globals this module SETS ──────────────────────────────────────────
export interface DataWindow {
  CODEX_DATA?: CodexData;
}

export function dw(): DataWindow {
  return window as unknown as DataWindow;
}
