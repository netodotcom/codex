// reader — typed window boundary (migrated from components.jsx). The reader
// reads a handful of runtime globals (data, i18n, engines, sibling React
// components rendered conditionally). Centralise the typing here; components
// call rw() and read what they need, lazily, at render time.
import type React from "react";
import type { CodexData, Mark } from "./types.js";

export interface QuestEntry {
  id: string;
  title: string;
  blurb?: string;
  glyph?: string;
  run?: () => void;
}

export interface StreakInfo {
  current: number;
  longest: number;
}

export interface MarkSearchApi {
  rank(query: string, marks: Mark[], currentRef?: string): Promise<Array<{ key: string; reason: string }>>;
}

export interface ReaderWindow {
  t?: (k: string) => string;
  CODEX_DATA?: CodexData;
  CODEX_GEMATRIA?: unknown;
  CODEX_VERSION?: { v?: string };
  CODEX_LANG?: string;
  CODEX_QUESTS?: QuestEntry[];
  CODEX_ENGAGE?: { loadStreak?: () => StreakInfo | null };
  CODEX_NormieToggle?: React.ComponentType<{ text: string; scope?: string }>;
  MarkSearch?: MarkSearchApi;
  LeftRailResizer?: React.ComponentType;
  Library?: React.ComponentType<Record<string, unknown>>;
  Oracle?: React.ComponentType<Record<string, unknown>>;
  ReactDOM?: { createPortal(node: React.ReactNode, container: Element): React.ReactPortal };
  codexOpenOmni?: () => void;
}

export function rw(): ReaderWindow {
  return window as unknown as ReaderWindow;
}

// Local i18n shortcut — falls back to the key itself.
export function tx(k: string): string {
  const t = rw().t;
  return (t && t(k)) || k;
}
