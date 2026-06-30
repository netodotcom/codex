// reader — shared data shapes (migrated from components.jsx). These mirror the
// runtime CODEX_DATA / passage / mark structures the legacy app passes in.

export interface Translation {
  id: string;
  name: string;
  glyph: string;
  year: string | number;
  lang: string;
  license?: string;
  source?: string;
}

export interface Book {
  id: string;
  name: string;
  chapters: number;
  testament?: string;
}

export interface Verse {
  n: number;
  red?: Record<string, string[] | undefined>;
  _jesusVerse?: boolean;
  [translationId: string]: unknown;
}

export interface Passage {
  book: string;
  bookId: string;
  chapter: number;
  title?: string;
  subtitle?: string;
  verses: Verse[];
  loading?: boolean;
  error?: string | null;
}

export interface Mark {
  key: string;
  ref?: string;
  note?: string;
  color?: string;
  text?: string;
  ts?: number;
  pinned?: boolean;
}

export interface CodexData {
  translations: Translation[];
  books: Book[];
  tweaks?: { provider?: string; model?: string };
}

export interface HighlightColor {
  swatch?: string;
}
export type Highlights = Record<string, { color?: string } | undefined>;
