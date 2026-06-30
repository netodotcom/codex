// marks-plugin — typed window boundary (migrated from marks-plugin.jsx v10).
// The panel reads CODEX_DATA (books list + tweaks), CODEX_NOW (the reader's
// current position), CODEX_PLUGINS_API (plugin registry), and
// codexJumpToRef (reader navigation). On module load the index sets
// window.MarksX. Callers use mw() and read/write what they need, lazily, at
// call time — exactly like crossref-window.ts / vox-window.ts.

export interface MarksBook {
  id: string;
  name?: string;
}

export interface MarksNow {
  bookId?: string;
  chapter?: number | string;
  verse?: number | string;
  ref?: string;
}

export interface MarksData {
  books?: MarksBook[];
  tweaks?: {
    highlightColor?: string;
  };
}

export interface MarksPluginsApi {
  register(plugin: unknown): unknown;
}

export interface MarksWindow {
  CODEX_DATA?: MarksData;
  CODEX_NOW?: MarksNow;
  CODEX_PLUGINS_API?: MarksPluginsApi;
  codexJumpToRef?: (label: string) => void;
  /** Set by index.tsx at module-load time — same surface as v10. */
  MarksX?: unknown;
}

export function mw(): MarksWindow {
  return window as unknown as MarksWindow;
}
