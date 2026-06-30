// strongs — typed window boundary (migrated from strongs.jsx). Centralises all
// runtime globals the strongs feature reads (CODEX_MODULES, CODEX_PLUGINS_API)
// and sets (CODEX_StrongsLookup, CODEX_StrongsRenderer, CODEX_StrongsPanel).
// Callers use sw() and read/write lazily at call time — same pattern as vox-window.ts.
import type React from "react";

// ── Lexicon data shapes ───────────────────────────────────────────────────
export interface StrongsEntry {
  word: string;
  translit: string;
  gloss?: string;
  pron?: string;
  pos?: string;
  def?: string;
  usage?: number;
}

export interface StrongsLexicon {
  entries?: Record<string, StrongsEntry | undefined>;
  meta?: { _partial?: boolean };
}

export interface AlignmentToken {
  en: string;
  strongs?: string;
  lemma?: string;
}

export interface AlignmentModule {
  verses?: Record<string, AlignmentToken[] | undefined>;
}

// ── Module + plugin API shapes ────────────────────────────────────────────
export interface StrongsModulesApi {
  loadModule(id: string): Promise<unknown>;
}

export interface StrongsPluginsApi {
  register(plugin: unknown): unknown;
}

// ── The exported contract (globals we SET) ────────────────────────────────
export interface StrongsRenderer {
  renderInterlinear(verseRef: unknown, englishText: string): React.ReactElement;
  lookup(strongsNumber: string): StrongsEntry | null;
}

// Panel props — matches what the legacy passed via ctx || {}
export interface StrongsPanelProps {
  book?: string;
  bookId?: string;
  chapter?: number | string;
  verse?: number | string;
  [key: string]: unknown;
}

export interface StrongsWindow {
  CODEX_MODULES?: StrongsModulesApi;
  CODEX_PLUGINS_API?: StrongsPluginsApi;
  // set at module load (frozen export contract)
  CODEX_StrongsLookup?: (strongsNumber: string) => StrongsEntry | null;
  CODEX_StrongsRenderer?: StrongsRenderer;
  CODEX_StrongsPanel?: React.ComponentType<StrongsPanelProps>;
}

export function sw(): StrongsWindow {
  return window as unknown as StrongsWindow;
}
