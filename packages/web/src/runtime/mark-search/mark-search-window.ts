// mark-search — typed window boundary. All runtime global accesses go through
// msw() so the rest of the code never touches `window as any`.
// Mirrors the pattern established in reader-window.ts / crossref-window.ts.
import type { Mark, RankResult } from "./types.js";

// ── Window globals this feature READS ────────────────────────────────────────
// Only standard web APIs: localStorage and fetch (both on Window already).
// No CODEX-specific globals are read by this engine.

// ── Window globals this feature SETS  ────────────────────────────────────────
export interface MarkSearchApi {
  rank(query: string, marks: Mark[], context?: string): Promise<RankResult[]>;
  clearCache(): void;
}

export interface MarkSearchWindow {
  MarkSearch?: MarkSearchApi;
}

export function msw(): MarkSearchWindow {
  return window as unknown as MarkSearchWindow;
}
