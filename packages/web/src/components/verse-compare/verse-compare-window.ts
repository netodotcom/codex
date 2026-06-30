// verse-compare — typed window boundary (migrated from verse-compare.jsx).
// Reads CODEX_DATA (translations list) and BIBLE.loadChapter at runtime;
// SETS window.VerseCompare on import of index.tsx. Centralise the typing here;
// callers use vcw() and read/write what they need, lazily, at call time —
// exactly like reader-window.ts.
import type React from "react";

// ── Translation shape ─────────────────────────────────────────────────────
export interface Translation {
  id: string;
  glyph?: string;
  name?: string;
  year?: string | number;
  lang?: string;
}

// ── Chapter/verse data shapes ─────────────────────────────────────────────
// loadChapter returns an array of verse objects; each has n (verse number),
// an optional text field, and possibly a keyed field for the translation id.
export interface ChapterVerse {
  n: number;
  text?: string;
  [key: string]: unknown;
}

export interface ChapterError {
  error: string;
}

// A cached chapter entry is either the verse array (success) or an error bag.
export type ChapterEntry = ChapterVerse[] | ChapterError;

// ── BIBLE api ─────────────────────────────────────────────────────────────
export interface BibleApi {
  loadChapter(bookId: string, chapter: number, tId: string): Promise<ChapterVerse[]>;
}

// ── Passage prop shape ────────────────────────────────────────────────────
export interface ComparePassage {
  bookId: string;
  chapter: number;
  book: string;
}

// ── VerseCompare component props (the frozen export contract) ─────────────
export interface VerseCompareProps {
  verse?: { n?: number } | null;
  /** Unused by the component body; kept for API compatibility with callers. */
  refStr?: string;
  passage: ComparePassage;
  primary: string;
  onClose: () => void;
}

// ── The window ────────────────────────────────────────────────────────────
export interface VerseCompareWindow {
  CODEX_DATA?: { translations: Translation[] };
  BIBLE?: BibleApi;
  // set at module load (the frozen export contract)
  VerseCompare?: React.ComponentType<VerseCompareProps>;
}

export function vcw(): VerseCompareWindow {
  return window as unknown as VerseCompareWindow;
}
