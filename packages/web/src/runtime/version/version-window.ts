// version — typed window boundary.  All window casts for this engine live here;
// the rest of the code never touches `window as any`.
// Mirrors the pattern established in repo-add-window.ts / crossref-window.ts.
import type { CodexVersion } from "./types.js";

// ── Window globals this engine SETS ──────────────────────────────────────────
export interface VersionWindow {
  CODEX_VERSION: CodexVersion;
}

export function vw(): VersionWindow {
  return window as unknown as VersionWindow;
}
