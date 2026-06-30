// reader (soul) — source resolution, the "open anything" workflow (migrated
// verbatim from reader.jsx). readerSourceChain returns an ordered list of
// translation ids likely to carry `book`, current primary first. DC books prefer
// translations whose declared canons include the book's canon; OT/NT books
// prefer protestant/ot/nt. readerLoad walks that chain over the immortal
// window.BIBLE engine (law 5) and remembers the per-book resolved source.
import { sw } from "./soul-window.js";
import type { SoulBook, SoulTranslation, SoulVerse, BibleApi } from "./soul-window.js";

export function readerSourceChain(book: SoulBook | undefined, primary: string): string[] {
  const all = sw().CODEX_DATA?.translations || [];
  const canonsOf = (t: SoulTranslation): Set<string> =>
    new Set((t.canons && t.canons.length) ? t.canons : ["protestant"]);
  const covers = (t: SoulTranslation): boolean => {
    const c = canonsOf(t);
    if (!book) return c.has("protestant");
    if (book.testament === "OT") return c.has("protestant") || c.has("ot");
    if (book.testament === "NT") return c.has("protestant") || c.has("nt");
    return c.has(book.canon ?? ""); // DC — needs an explicit canon match
  };
  const chain: string[] = [];
  const cur = all.find((t) => t.id === primary);
  if (cur && covers(cur)) chain.push(primary);
  for (const t of all) {
    if (t.id === primary) continue;
    if (covers(t)) chain.push(t.id);
  }
  // Last resort: current primary anyway (its network chain may surprise us).
  if (!chain.length) chain.push(primary);
  return chain;
}

// Per-book resolved source, remembered for the session so chapter flips inside
// 1 Enoch don't re-walk the registry every time.
export const _readerSourceMemo: Record<string, string | undefined> = {};

export interface ReaderLoadResult {
  verses: SoulVerse[];
  translation: string;
  fallback: boolean;
}

export async function readerLoad(bookId: string, chapter: number, primary: string): Promise<ReaderLoadResult> {
  const B = sw().BIBLE;
  const books = sw().CODEX_DATA?.books || [];
  const book = books.find((b) => b.id === bookId);
  const memo = _readerSourceMemo[bookId];
  const chain = memo
    ? [memo, ...readerSourceChain(book, primary).filter((t) => t !== memo)]
    : readerSourceChain(book, primary);
  let lastErr: unknown = null;
  for (const tr of chain) {
    try {
      const verses = await (B as BibleApi).loadMulti(bookId, chapter, [tr]);
      if (verses && verses.length) {
        _readerSourceMemo[bookId] = tr;
        return { verses, translation: tr, fallback: tr !== primary };
      }
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error(`No source carries ${bookId} ${chapter}`);
}

// Highlight palette — mirrors app.jsx HIGHLIGHT_COLORS swatches without importing
// across the IIFE boundary (colors are data, not logic).
export const READER_HL: Record<string, string> = {
  amber: "#ffd479", rose: "#ff8291", mint: "#5bd0b0",
  violet: "#b88cff", cyan: "#7ee0ff", gold: "#ffd479",
};

export type ReaderMarks = Record<string, { color?: string } | undefined>;

export function readerHighlights(): ReaderMarks {
  try { return JSON.parse(localStorage.getItem("codex.highlights.v1") || "{}") as ReaderMarks; }
  catch { return {}; }
}

export const READER_FONTS: number[] = [16, 19, 22, 26, 30];
