// CODEX Plugins — typed window boundary. All runtime global accesses go
// through pw() so the rest of the code never touches `window as any`.
// Mirrors the pattern established in gematria-window.ts / modules-window.ts.
import type { CodexPluginsApi, Plugin } from "./types.js";

// ── Window globals this module SETS ──────────────────────────────────────────
export interface PluginsWindow {
  // The public array third-party scripts may push into directly.
  CODEX_PLUGINS?: Plugin[];
  // The programmatic API object.
  CODEX_PLUGINS_API?: CodexPluginsApi;
}

export function pw(): PluginsWindow {
  return window as unknown as PluginsWindow;
}
