// observability — typed window boundary.
// All `window as ...` casts live here so the rest of the module never touches
// `window as any`. Mirrors the pattern in repo-add-window.ts.
import type { CodexError } from "./types.js";

// ── Window globals this engine READS ─────────────────────────────────────────
// ── Window globals this engine SETS  ─────────────────────────────────────────
export interface ObservabilityWindow {
  /** Ring-buffer array of captured errors.
   * Initialised to [] at module load if absent; pre-existing inline-0.0
   * entries are preserved. */
  __CODEX_ERRORS__?: CodexError[];
}

export function ow(): ObservabilityWindow {
  return window as unknown as ObservabilityWindow;
}
