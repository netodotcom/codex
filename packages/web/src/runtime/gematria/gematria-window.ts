// Gematria — typed window boundary. All runtime global accesses go through
// gw() so the rest of the code never touches `window as any`.
// Mirrors the pattern established in reader-window.ts / repo-add-window.ts.
import type { Lang, AllResult, AtbashResult, AlbamResult, IndexMatch, IndexRecord, IndexStats } from "./types.js";

// ── CODEX_GEMATRIA shape ──────────────────────────────────────────────────────
// Faithfully mirrors the object the legacy IIFE assigned to window.CODEX_GEMATRIA.
export interface CodexGematria {
  detectLang(s: string): Lang;
  strip(s: string): string;
  hebrew: {
    hechrachi(s: string): number;
    gadol(s: string): number;
    sidduri(s: string): number;
    katan(s: string): number;
    katan_mispari(s: string): number;
    boneh(s: string): number;
    kidmi(s: string): number;
    atbash(s: string): AtbashResult;
    albam(s: string): AlbamResult;
    neelam(s: string): number;
    haakhor(s: string): number;
  };
  greek: {
    isopsephy(s: string): number;
    ordinal(s: string): number;
    reduced(s: string): number;
  };
  english: {
    ordinal(s: string): number;
    reduction(s: string): number;
    reverse(s: string): number;
  };
  all(text: string, lang?: Lang): AllResult;
}

// ── CODEX_GEMATRIA_INDEX shape ────────────────────────────────────────────────
// Faithfully mirrors window.CODEX_GEMATRIA_INDEX from legacy/gematria.js.
export interface CodexGematriaIndex {
  build(opts?: Record<string, unknown>): Promise<IndexRecord | null>;
  find(value: number, opts?: { system?: string }): IndexMatch[];
  stats(): IndexStats;
  reset(): void;
  ensure(): Promise<IndexRecord | null>;
}

// ── Window globals this feature READS ────────────────────────────────────────
// Minimal slice of window.BIBLE consumed by the index builder.
export interface GematriaWindowBible {
  /** Resolves when the bible engine has finished its initial load (optional). */
  ready?: Promise<unknown>;
  /** In-memory chapter cache: keys are "bookId.chapter.translation". */
  _memCache?: Record<string, unknown>;
}

// ── Full typed window boundary ────────────────────────────────────────────────
export interface GematriaWindow {
  // Globals this module SETS
  CODEX_GEMATRIA?: CodexGematria;
  CODEX_GEMATRIA_INDEX?: CodexGematriaIndex;
  // Globals this module READS
  BIBLE?: GematriaWindowBible;
  // IndexedDB may be absent (SSR / test environments without full DOM)
  indexedDB?: IDBFactory;
}

export function gw(): GematriaWindow {
  return window as unknown as GematriaWindow;
}
