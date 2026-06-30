// compare — typed window boundary. The compare plugin sets one window global
// (CODEX_ComparePanel) and reads CODEX_PLUGINS_API for plugin registration.
// Callers use cw() and read/write what they need at call time — same pattern
// as crossref-window.ts / vox-window.ts.
import type React from "react";

export interface ComparePanelDef {
  id: string;
  label: string;
  glyph: string;
  render(ctx: Record<string, unknown>): React.ReactElement;
}

export interface ComparePlugin {
  id: string;
  name: string;
  version: string;
  panels: ComparePanelDef[];
}

export interface CompareWindow {
  // Set at module load (the frozen export contract):
  CODEX_ComparePanel?: React.ComponentType<Record<string, unknown>>;
  // Read for plugin registration:
  CODEX_PLUGINS_API?: { register(plugin: ComparePlugin): unknown };
}

export function cw(): CompareWindow {
  return window as unknown as CompareWindow;
}
