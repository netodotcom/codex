// modules — typed window boundary. All runtime global accesses go through
// mw() so the rest of the code never touches `window as any`.
// Mirrors the pattern established in repo-add/repo-add-window.ts.
import type { CodexModulesApi } from "./types.js";

// ── Window globals this module SETS ──────────────────────────────────────────
// ── Window globals this module READS ─────────────────────────────────────────
//   fetch   — standard Browser API (no custom global slice needed)
//   indexedDB — standard Browser API (typed via DOM lib)
export interface ModulesWindow {
  CODEX_MODULES?: CodexModulesApi;
}

export function mw(): ModulesWindow {
  return window as unknown as ModulesWindow;
}
