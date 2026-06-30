// winhost — typed window boundary (migrated from winhost.jsx). winhost reads a
// handful of runtime globals (CODEX_NOW, CODEX_DATA, CODEX_PLUGINS_API,
// PluginPanelHost, ReactDOM, codexOpenPanel) and sets three
// (WinHostRoot, codexOpenWindow, codexOpenPanel — wraps and restores).
// Centralise the typing here; callers use ww() and read/write what they need,
// lazily, at call time — exactly like reader-window.ts and vox-window.ts.
import type React from "react";

// ── Passage context shape broadcast on the codex:now bus ─────────────────
export interface CodexNow {
  ref?: string;
  book?: string;
  bookId?: string;
  chapter?: number;
  verse?: number;
  translation?: string;
}

// ── App-wide config / tweaks ──────────────────────────────────────────────
export interface CodexData {
  tweaks?: {
    primary?: string;
  };
}

// ── Plugin panel descriptor ────────────────────────────────────────────────
export interface PluginPanel {
  pluginId: string;
  id: string;
  glyph?: string;
}

export interface CodexPluginsApi {
  getPanels?(): PluginPanel[];
}

// ── Host component props (what CodexWin passes to PluginPanelHost) ─────────
export interface PluginPanelHostProps {
  panel: PluginPanel;
  book?: string;
  bookId?: string;
  chapter?: number;
  verse?: number;
  translation?: string;
}

// ── Minimal ReactDOM surface used for self-mounting ───────────────────────
export interface WinhostReactDom {
  createRoot(el: Element): { render(node: React.ReactNode): void };
}

// ── The window ─────────────────────────────────────────────────────────────
export interface WinhostWindow {
  CODEX_NOW?: CodexNow;
  CODEX_DATA?: CodexData;
  CODEX_PLUGINS_API?: CodexPluginsApi;
  PluginPanelHost?: React.ComponentType<PluginPanelHostProps>;
  ReactDOM?: WinhostReactDom;
  codexOpenPanel?: (id: string) => void;
  codexOpenWindow?: (spec: { id: string; title?: string; glyph?: string }) => boolean;
  WinHostRoot?: React.ComponentType;
}

export function ww(): WinhostWindow {
  return window as unknown as WinhostWindow;
}
