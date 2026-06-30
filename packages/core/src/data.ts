// Static scripture data — book canon, translation registry, and the seed
// panel content for John 1. Extracted faithfully from data.js (window.CODEX_DATA)
// into JSON so the data stays data; this module gives it types and lookups.

import booksJson from "./data/books.json";
import translationsJson from "./data/translations.json";
import seedPanelsJson from "./data/seed-panels.json";

export type Testament = "OT" | "NT" | "DC";

export interface Book {
  id: string;
  name: string;
  testament: Testament;
  chapters: number;
  /** present on deuterocanonical books, e.g. "deuterocanon", "ethiopian" */
  canon?: string;
}

export interface TranslationMirror {
  kind: string;
  apiId: string;
}

export interface Translation {
  id: string;
  name: string;
  year: string;
  license: string;
  glyph: string;
  lang: string;
  source: string;
  apiId: string;
  mirrors?: TranslationMirror[];
  bundle?: string;
  offlinePriority?: string;
  canons?: string[];
}

export interface DefaultPassage {
  bookId: string;
  chapter: number;
}

export interface SeedPanel {
  title: string;
  subtitle: string;
  talmud?: Array<{ ref: string; heading: string; body: string; tag: string }>;
  commentary?: Array<{ from: string; author: string; body: string }>;
  gematria?: Array<{ term: string; translit: string; meaning: string; value: number; system: string }>;
  gematriaNotes?: string[];
  gnosis?: Array<{ sigil: string; title: string; body: string }>;
  crossRefs?: Array<{ ref: string; note: string }>;
  disarm?: {
    entries: Array<{ verse: string; weaponization: string; quote: string; source: string; rebuttal: string }>;
  };
}

// The JSON is trusted (extracted from the live data); the test suite validates
// its runtime shape, which is the real guarantee behind these casts.
export const books = booksJson as unknown as Book[];
export const translations = translationsJson as unknown as Translation[];
export const seedPanels = seedPanelsJson as unknown as Record<string, SeedPanel>;

export const defaultPassage: DefaultPassage = { bookId: "jhn", chapter: 1 };

const BOOK_BY_ID = new Map<string, Book>(books.map((b) => [b.id, b]));
const TRANSLATION_BY_ID = new Map<string, Translation>(translations.map((t) => [t.id, t]));

export function bookById(id: string): Book | undefined {
  return BOOK_BY_ID.get(id);
}

export function translationById(id: string): Translation | undefined {
  return TRANSLATION_BY_ID.get(id);
}
