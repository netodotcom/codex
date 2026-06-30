// verse-art — typed window boundary. verse-art reads one runtime global
// (CODEX_INTEL, for truncation-tolerant JSON parsing) and writes one back
// (VerseArt, the React component). Centralise the typing here; callers use
// vaw() and access what they need, lazily, at call time.
import type React from "react";

// ── CODEX_INTEL shape (only the slice verse-art uses) ────────────────────
export interface CodexIntelApi {
  intelParseJSON(s: string): unknown;
}

// ── VerseArt component props ──────────────────────────────────────────────
export interface ArtPassage {
  bookId: string;
  chapter: number;
}

export interface ArtVerse {
  n?: number | string;
}

export interface VerseArtProps {
  verse?: ArtVerse;
  refStr: string;
  verseText: string;
  passage: ArtPassage;
  primary?: boolean;
  onClose: () => void;
}

// ── The window ────────────────────────────────────────────────────────────
export interface VerseArtWindow {
  CODEX_INTEL?: CodexIntelApi;
  VerseArt?: React.ComponentType<VerseArtProps>;
}

export function vaw(): VerseArtWindow {
  return window as unknown as VerseArtWindow;
}
