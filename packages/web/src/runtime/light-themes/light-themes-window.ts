// light-themes — typed window boundary. All runtime global accesses go through
// ltw() so the rest of the code never touches `window as any`.
// Mirrors the pattern established in repo-add-window.ts / reader-window.ts.
import type { LightThemesApi } from "./types.js";

// ── Window globals this feature SETS ─────────────────────────────────────────
export interface LightThemesWindow {
  CODEX_LIGHT_THEMES?: LightThemesApi;
}

export function ltw(): LightThemesWindow {
  return window as unknown as LightThemesWindow;
}
