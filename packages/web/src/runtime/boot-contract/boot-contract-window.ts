// boot-contract — typed window boundary.
// All `window as …` casts live here so the rest of the module never touches
// `window as any`. Mirrors the pattern in observability-window.ts.
import type { BootCodexError, CodexBootContract } from "./types.js";

// ── Window globals this engine READS ─────────────────────────────────────────
// __CODEX_ERRORS__ — ring-buffer initialised by observability; this module
//   preserves any existing entries and pushes boot-contract failures into it.
//
// ── Window globals this engine SETS ──────────────────────────────────────────
// CODEX_BOOT_CONTRACT — the manifest of critical globals + their shape predicates.
// __CODEX_READY__ — true when all globals pass; false when deadline exceeded.
export interface BootContractWindow {
  __CODEX_ERRORS__?: BootCodexError[];
  CODEX_BOOT_CONTRACT?: CodexBootContract;
  __CODEX_READY__?: boolean;
}

export function bcw(): BootContractWindow {
  return window as unknown as BootContractWindow;
}

/** Reads an arbitrary window property by string name for the shape-predicate
 * loop in checkOnce. Returns undefined on any access error (matches the
 * per-entry try/catch in the original).
 * NOTE: preserved from legacy — window[g.name] access pattern. */
export function getWindowGlobal(name: string): unknown {
  try {
    return (window as unknown as Record<string, unknown>)[name];
  } catch {
    return undefined;
  }
}
