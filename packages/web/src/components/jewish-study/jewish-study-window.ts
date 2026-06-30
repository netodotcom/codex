// jewish-study — typed window boundary (migrated from jewish-study.jsx). The
// panel reads a handful of runtime globals (modules loader, book data, months
// cache, navigation hooks, text opener, plugin API) and SETS two at module-load
// time (CODEX_JEWISH, CODEX_JewishStudyPanel), plus CODEX_JEWISH_MONTHS_CACHE
// inside the component's useEffect when calendar data arrives. Centralise the
// typing here; callers use jw() and read/write what they need, lazily.
import type React from "react";

// ── Hebrew calendar data shapes ────────────────────────────────────────────
export interface HebrewMonth {
  n: number;
  name: string;
  translit: string;
  approxGregorian?: string;
  notes?: string;
}

export interface HebrewDate {
  day: number;
  month: HebrewMonth;
  year: number;
  daysSinceAnchor: number;
}

export interface Holiday {
  id: string;
  hebrew: string;
  name: string;
  date: string;
  readings?: string[];
}

export interface Parasha {
  n: number;
  name: string;
  translit: string;
  meaning: string;
  torah: string;
  haftarah: string;
}

export interface ParshaModule {
  parashot: Parasha[];
}

export interface CalendarModule {
  months: HebrewMonth[];
  holidays: Holiday[];
}

export interface DafEntry {
  day?: number | null;
  readings: string[];
}

export interface DafModule {
  days: DafEntry[];
}

// ── Runtime API shapes ─────────────────────────────────────────────────────
export interface CodexModulesApi {
  loadModule(id: string): Promise<unknown>;
}

export interface PluginPanelSpec {
  id: string;
  label: string;
  glyph: string;
  render(ctx: Record<string, unknown>): React.ReactElement;
}

export interface PluginsApi {
  register(plugin: { id: string; name: string; version: string; panels: PluginPanelSpec[] }): unknown;
}

export interface JewishApi {
  currentParsha(): Promise<Parasha | null>;
  nextHoliday(): Promise<(Holiday & { daysUntil: number }) | null>;
  hebrewDate(d?: Date): Promise<HebrewDate>;
}

// ── The window ─────────────────────────────────────────────────────────────
export interface JewishWindow {
  CODEX_MODULES?: CodexModulesApi;
  CODEX_DATA?: { books?: Array<{ id?: string; name?: string }> };
  CODEX_JEWISH_MONTHS_CACHE?: HebrewMonth[];
  codexJumpToRef?: (display: string) => void;
  codexOpenText?: (ref: string) => void;
  CODEX_PLUGINS_API?: PluginsApi;
  CODEX_JEWISH?: JewishApi;
  CODEX_JewishStudyPanel?: unknown;
}

export function jw(): JewishWindow {
  return window as unknown as JewishWindow;
}
