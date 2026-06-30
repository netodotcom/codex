// mobile — typed window boundary (migrated from mobile.jsx v12 THE PALM). The
// shell reads several runtime globals (the reading cursor, the plugin registry,
// sibling components, navigation helpers) and writes two (window.CodexMobileShell
// at module load; window.codexMobile at mount, removed at unmount). Centralise
// the typing here; callers use mw() and read/write lazily at call time.
import type React from "react";

// ── Streak ────────────────────────────────────────────────────────────────
export interface StreakData {
  current: number;
  lastDate?: string;
}
export interface CodexEngageApi {
  loadStreak?: () => StreakData | null;
}

// ── Plugin panel registry ─────────────────────────────────────────────────
export interface PluginPanelInfo {
  pluginId: string;
  id: string;
  glyph?: string;
  label?: string;
}
export interface CodexPluginsApi {
  getPanels?: () => PluginPanelInfo[];
  register?: (plugin: unknown) => unknown;
}

// ── Reading cursor ────────────────────────────────────────────────────────
export interface CodexNow {
  book?: string;
  bookId?: string;
  chapter?: number;
  verse?: number;
  ref?: string;
  translation?: string;
}

// ── App data / tweaks ──────────────────────────────────────────────────────
export interface CodexTweaks {
  primaryTranslation?: string;
}
export interface CodexData {
  tweaks?: CodexTweaks;
}

// ── PluginPanelHost ───────────────────────────────────────────────────────
export interface PluginPanelHostProps {
  panel: PluginPanelInfo;
  book?: string;
  bookId?: string;
  chapter: number;
  verse: number;
  translation: string;
}

// ── Built-in window entry (the map the desk passes down) ──────────────────
export interface BuiltinWinEntry {
  glyph: string;
  title: string;
}

// ── CodexMobileShell props (the public API the app uses) ──────────────────
export interface CodexMobileShellProps {
  builtinWin?: Record<string, BuiltinWinEntry>;
  builtinBody?: (id: string) => React.ReactNode;
  busy?: boolean;
  dark?: boolean;
  onToggleTheme?: () => void;
}

// ── Public router (written at mount, deleted at unmount) ──────────────────
export interface MobileApi {
  on: () => true;
  open: (spec: string) => boolean;
  closeAll: () => void;
  focus: (v?: boolean) => void;
  state: () => { sheets: string[]; palm: boolean; focus: boolean; orb: string };
}

// ── The window ─────────────────────────────────────────────────────────────
export interface MobileWindow {
  CODEX_ENGAGE?: CodexEngageApi;
  CODEX_PLUGINS_API?: CodexPluginsApi;
  CODEX_NOW?: CodexNow | null;
  CODEX_DATA?: CodexData;
  PluginPanelHost?: React.ComponentType<PluginPanelHostProps>;
  codexOpenOmni?: () => void;
  codexOpenConstellation?: () => void;
  codexOpenPanel?: (id: string) => void;
  codexJumpToRef?: (ref: string) => void;
  LibraryX?: React.ComponentType;
  OracleX?: React.ComponentType;
  MarksX?: React.ComponentType;
  CodexReaderX?: React.ComponentType<{ surface?: string }>;
  codexMobile?: MobileApi;
  CodexMobileShell?: React.ComponentType<CodexMobileShellProps>;
}

export function mw(): MobileWindow {
  return window as unknown as MobileWindow;
}
