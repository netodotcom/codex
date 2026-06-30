// vox — typed window boundary (migrated from vox.jsx). VOX reads a handful of
// runtime globals (data, the BIBLE store, the modules loader, the AI engine, the
// plugins API) and writes two (CODEX_VOX, CODEX_VoxPanel). Centralise the typing
// here; callers use vw() and read what they need, lazily, at call time. Standard
// browser globals (speechSynthesis, localStorage, fetch, CustomEvent) keep their
// lib.dom typings and are used directly.

// ── Bible data shapes ──────────────────────────────────────────────────────
export interface VoxBook {
  id?: string;
  name?: string;
}
export interface VoxTranslation {
  id?: string;
  lang?: string;
  language?: string;
}
export interface VoxData {
  books?: VoxBook[];
  translations?: VoxTranslation[];
}

// CODEX verses are { n, <translationId>: text, ... }.
export interface VoxVerse {
  n?: number | string;
  verse?: number | string;
  num?: number | string;
  kjv?: string;
  web?: string;
  text?: string;
  t?: string;
  [key: string]: unknown;
}

export interface VoxBibleApi {
  loadChapter?(bookId?: string, chapter?: number | string, translation?: string): Promise<unknown>;
  getCachedChapter?(bookId?: string, chapter?: number | string, translation?: string): unknown;
}

export interface VoxModulesApi {
  loadModule?(id: string): Promise<unknown>;
}

export interface VoxAiProvider {
  provider?: string;
  model?: string;
}
export interface VoxAiApi {
  getActiveProvider?(): VoxAiProvider | null;
}

// ── Prayer-format module shapes ────────────────────────────────────────────
export interface PrayerSection {
  type?: string;
  text?: string;
  duration?: number | string;
}
export interface PrayerFormat {
  id: string;
  name?: string;
  tradition?: string;
  badge?: string;
  summary?: string;
  sections?: PrayerSection[];
  pace_rate?: number;
  lang_default?: string;
}
export interface PrayerPack {
  formats?: PrayerFormat[];
}

export interface VoxPluginsApi {
  register(plugin: unknown): unknown;
}

// ── Panel context + per-voice prefs (internal domain types) ────────────────
export interface VoxCtx {
  book?: string;
  bookId?: string;
  chapter?: number | string;
  verse?: number | string;
  translation?: string;
}
export interface VoxPrefs {
  rate: number;
  pitch: number;
  volume: number;
}

export interface VoxWindow {
  CODEX_DATA?: VoxData;
  BIBLE?: VoxBibleApi;
  CODEX_MODULES?: VoxModulesApi;
  CODEX_AI?: VoxAiApi;
  CODEX_PLUGINS_API?: VoxPluginsApi;
  CODEX_VOX?: unknown;
  CODEX_VoxPanel?: unknown;
}

export function vw(): VoxWindow {
  return window as unknown as VoxWindow;
}
