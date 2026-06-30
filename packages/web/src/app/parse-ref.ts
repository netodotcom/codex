// app — human reference parser (migrated from app.jsx). Turns "1 John 2:5" /
// "Genesis 3" into { bookId, chapter, verse } against the loaded book list.
// Pure: the caller passes the books, so it's fully testable.
export interface RefBook {
  id: string;
  name: string;
  chapters: number;
}
export interface ParsedAppRef {
  bookId: string;
  chapter: number;
  verse: number;
}

export function parseRef(ref: string, books: RefBook[]): ParsedAppRef | null {
  if (!ref) return null;
  const m = ref.trim().match(/^([\dIVX]+\s*)?([A-Za-zéÀ-ſ]+(?:\s+(?:of\s+)?[A-Za-z]+)?)\s+(\d+)(?::(\d+))?/);
  if (!m) return null;
  const prefix = (m[1] || "").trim().replace(/\s+/g, "");
  const word = m[2] ?? "";
  const ch = parseInt(m[3] ?? "", 10);
  const v = m[4] ? parseInt(m[4], 10) : 1;
  const wantName = (prefix ? prefix + " " : "") + word;
  const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const wantNorm = norm(wantName);
  const wantWordNorm = norm(word);
  const book =
    books.find((b) => norm(b.name) === wantNorm || norm(b.name).startsWith(wantNorm)) ||
    books.find((b) => norm(b.name).includes(wantWordNorm));
  if (!book) return null;
  return { bookId: book.id, chapter: Math.min(ch, book.chapters), verse: v };
}
