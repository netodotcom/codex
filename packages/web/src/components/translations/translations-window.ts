// translations — typed window boundary (migrated from translations.jsx). The
// translations panel reads several runtime globals (data, offline-state machine,
// the bible cache, user repos, the RepoAdd companion component) and writes one
// (CodexTranslationsX). Centralise the typing here; callers use tw() and read
// what they need, lazily, at call/render time.
import type React from "react";

// ── Verse + passage shapes ────────────────────────────────────────────────
export interface TxVerse {
  n: string | number;
  [key: string]: unknown;
}
export interface TxPassage {
  book: string;
  chapter: string | number;
  verses: TxVerse[];
}

// ── Translation registry shapes ───────────────────────────────────────────
export interface TxTranslation {
  id: string;
  name: string;
  lang?: string;
  glyph?: string;
  year?: string | number;
  license?: string;
  placeholder?: boolean;
  source?: string;
}

export interface TxCodexData {
  translations: TxTranslation[];
  books: unknown[];
}

// ── Offline-state machine (panels.jsx / window.CODEX_TRANS_STATE) ─────────
export interface TxStats {
  fully?: boolean;
  total?: number;
  cached?: number;
}
export interface TxDl {
  complete?: boolean;
  aborted?: boolean;
  total?: number;
  done?: number;
}
export interface TxTransState {
  subscribe(fn: () => void): (() => void) | null | undefined;
  get(id: string): TxDl | null | undefined;
  stop(t: TxTranslation): void;
  clear(t: TxTranslation): void;
  start(t: TxTranslation): void;
  maybeAutoBundle?(t: TxTranslation, books: unknown[]): void;
}

// ── BIBLE cache API ───────────────────────────────────────────────────────
export interface TxBibleApi {
  cacheStats?(id: string, books: unknown[]): TxStats;
  ready?: Promise<unknown>;
}

// ── User repo shapes ──────────────────────────────────────────────────────
export interface TxRepo {
  id: string;
}

// ── Panel props (shared between TranslationsPanel and the window type) ────
export interface TranslationsPanelProps {
  primary: string;
  onPrimary: (id: string) => void;
  compareSet: string[];
  onToggleCompare: (id: string) => void;
  passage: TxPassage;
  currentVerse: string | number;
}

// ── Window globals ─────────────────────────────────────────────────────────
export interface TranslationsWindow {
  CODEX_DATA?: TxCodexData;
  CODEX_TRANS_STATE?: TxTransState;
  BIBLE?: TxBibleApi;
  loadRepos?: () => TxRepo[];
  removeRepo?: (id: string) => void;
  RepoAdd?: React.ComponentType<{ onAdded: () => void }>;
  CodexTranslationsX?: React.ComponentType<TranslationsPanelProps>;
}

export function tw(): TranslationsWindow {
  return window as unknown as TranslationsWindow;
}
