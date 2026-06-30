// displays — typed window boundary. All runtime global accesses go through
// dw() so the rest of the code never touches `window as any`.
// Mirrors the pattern established in modules-window.ts / version-window.ts.

import type { CodexDisplaysApi } from "./types.js";

// ── Window globals this engine SETS ──────────────────────────────────────────
//   __CXDISPLAYS     — boolean sentinel; prevents double-init (checked first in IIFE)
//   codexDisplays    — public multi-display API

// ── Window globals this engine READS ─────────────────────────────────────────
//   CODEX_NOW        — current reading cursor { ref? } (nav engine, not yet migrated)
//   __CODEX_READY__  — app readiness sentinel (boot engine, not yet migrated)
//   codexJumpToRef   — navigate to a ref string (nav engine, not yet migrated)
//   codexDesk        — desk controller: open/close/state panels (desk engine, not yet migrated)
//   codexOpenPanel   — open a built-in panel by id (panel engine, not yet migrated)
//   codexOpenConstellation — open the galaxy/constellation view (not yet migrated)

/** Minimal read slice for the desk controller (not yet migrated). */
export interface DeskApi {
  on?(): boolean;
  state?(): Record<string, unknown>;
  open?(key: string): void;
  close?(key: string): void;
}

export interface DisplaysWindow {
  // SET by this engine
  __CXDISPLAYS?: boolean;
  codexDisplays?: CodexDisplaysApi;

  // READ from not-yet-migrated engines (minimal read slices)
  CODEX_NOW?: { ref?: unknown };
  __CODEX_READY__?: boolean;
  codexJumpToRef?: (ref: string) => void;
  codexDesk?: DeskApi;
  codexOpenPanel?: (id: string) => void;
  codexOpenConstellation?: () => void;
}

export function dw(): DisplaysWindow {
  return window as unknown as DisplaysWindow;
}
