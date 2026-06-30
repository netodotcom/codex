// crossref — pure-ish helpers (migrated faithfully from crossref.jsx). Key
// parsing / display, covenant colors, theme hashing, and the snippet reader.
// Everything that only touches its arguments is ground-truth tested; the few
// that read window globals (books data, the bible cache, the live --cx-fg) go
// through the typed boundary in crossref-window.ts.
import { xw } from "./crossref-window.js";
import type { CodexBook, CachedChapter, ChapterVerse, ParsedKey } from "./crossref-window.js";

// The app's covenant language (mirrors the Galaxy).
export const OT_C = "#7ee0ff"; // OT — cyan
export const NT_C = "#e8b465"; // NT — amber
export const SEAM_C = "#ffd479"; // the seam — gold, for edges that cross covenants
export const SERIF_FONT = 'Georgia, "Iowan Old Style", "Times New Roman", serif';
export const MONO_FONT = '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace';

// ── Book id ↔ display name helpers ────────────────────────────────────────
export function booksList(): CodexBook[] {
  const data = xw().CODEX_DATA;
  return (data && data.books) || [];
}
export function bookName(bookId: string): string {
  const b = booksList().find((x) => x.id === bookId);
  return b ? b.name : bookId;
}
// Canonical index + testament for a book id.
export function bookMeta(bookId: string): { index: number; testament: string | null } {
  const books = booksList();
  const i = books.findIndex((b) => b.id === bookId);
  const book = i >= 0 ? books[i] : undefined;
  return { index: i, testament: book ? book.testament : null };
}

// Parse "jhn.3.16" → { bookId:"jhn", chapter:3, verse:16 }
export function parseVerseKey(key: unknown): ParsedKey | null {
  if (!key || typeof key !== "string") return null;
  const parts = key.split(".");
  if (parts.length < 2) return null;
  const bookId = parts[0]!.toLowerCase();
  const chapter = parseInt(parts[1]!, 10);
  const verse = parts[2] ? parseInt(parts[2], 10) : null;
  if (!bookId || !Number.isFinite(chapter)) return null;
  return { bookId, chapter, verse };
}

// Build "Book C:V" display string from key.
export function formatRef(key: string): string {
  const p = parseVerseKey(key);
  if (!p) return key;
  return `${bookName(p.bookId)} ${p.chapter}${p.verse ? ":" + p.verse : ""}`;
}

// Compact mono label for orbit nodes: "GEN 1:1".
export function shortRef(key: string): string {
  const p = parseVerseKey(key);
  if (!p) return key;
  return `${p.bookId.toUpperCase()} ${p.chapter}${p.verse ? ":" + p.verse : ""}`;
}

// Accept a verse key ("gen.1.1") OR a human ref ("Genesis 1:1") → key.
export function normalizeKey(ref: unknown): string | null {
  if (!ref) return null;
  const s = String(ref).trim();
  if (/^[0-9a-z]{2,3}\.\d+(\.\d+)?$/i.test(s)) return s.toLowerCase();
  const m = s.match(/^(.+?)\s+(\d+)(?:[:.](\d+))?$/);
  if (!m) return null;
  const nm = m[1]!.trim().toLowerCase();
  const b = booksList().find((x) => x.name.toLowerCase() === nm || x.id === nm);
  if (!b) return null;
  return `${b.id}.${m[2]}${m[3] ? "." + m[3] : ""}`;
}

// ── Verse snippet — pull from window.BIBLE cache if available ─────────────
// (bible.js caches chapters as a bare verses ARRAY [{n,text}]; older code
// expected {verses:[…]} — support both shapes.)
export function chapterVerses(ch: CachedChapter): ChapterVerse[] {
  if (Array.isArray(ch)) return ch;
  if (ch && Array.isArray(ch.verses)) return ch.verses;
  return [];
}
export function snippetFor(key: string, translation?: string): string | null {
  try {
    const p = parseVerseKey(key);
    const bible = xw().BIBLE;
    if (!p || !bible || typeof bible.getCachedChapter !== "function") return null;
    const tr = translation || "kjv";
    const ch = bible.getCachedChapter(p.bookId, p.chapter, tr);
    const v = chapterVerses(ch).find((x) => x && x.n === (p.verse || 1));
    if (!v) return null;
    const text = v[tr] || v.text || "";
    return text ? String(text).trim() : null;
  } catch {
    return null;
  }
}

// ── Color helpers ──────────────────────────────────────────────────────────
export function rgba(hex: string | null | undefined, a: number): string {
  const h = String(hex || "#7ee0ff").replace("#", "");
  const f = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(f, 16);
  if (!Number.isFinite(n)) return `rgba(126,224,255,${a})`;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
// Stable theme → color (the sample TSK module carried {ref,theme} rows; the
// full corpus is bare strings — covenant colors then).
export const THEME_HUES = ["#7ee0ff", "#e8b465", "#b3a4ff", "#8fe6b8", "#ff9db1", "#ffd479", "#9ad0ff", "#e0c3fc"];
export function themeColor(theme: unknown): string {
  let h = 0;
  const s = String(theme);
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return THEME_HUES[h % THEME_HUES.length]!;
}
export function cssFg(): string {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue("--cx-fg").trim();
    return v || "#dfe7ec";
  } catch {
    return "#dfe7ec";
  }
}
