// dictionary — pure helpers and window-reading utilities
// (migrated faithfully from dictionary.jsx)
import { dw } from "./dictionary-window.js";

// ── Data shapes ────────────────────────────────────────────────────────────
export interface DictEntry {
  title?: string;
  body?: string;
  kind?: string;
  refs?: string[];
  related?: string[];
}

export interface DictModule {
  entries?: Record<string, DictEntry>;
  meta?: { _partial?: boolean };
}

export interface ParsedRef {
  bookId: string;
  chapter: number;
  verse: number | null;
}

// ── Module cache ──────────────────────────────────────────────────────────
const MODULE_ID = "easton-sample";

let _modPromise: Promise<DictModule> | null = null;

export function loadDict(): Promise<DictModule> {
  if (_modPromise) return _modPromise;
  const api = dw().CODEX_MODULES;
  if (!api || typeof api.loadModule !== "function") {
    return Promise.reject(new Error("CODEX_MODULES not available"));
  }
  _modPromise = api
    .loadModule(MODULE_ID)
    .then((m) => m as DictModule)
    .catch((e: unknown) => {
      _modPromise = null;
      throw e;
    });
  return _modPromise;
}

// Test-only helper to reset the module-level cache between test runs.
export function _resetDictModuleCache(): void {
  _modPromise = null;
}

// ── Helpers ───────────────────────────────────────────────────────────────
export function booksList(): Array<{ id: string; name: string }> {
  return (dw().CODEX_DATA && dw().CODEX_DATA?.books) || [];
}

export function bookName(bookId: string): string {
  const b = booksList().find((x) => x.id === bookId);
  return b ? b.name : bookId;
}

export function parseRefKey(key: unknown): ParsedRef | null {
  if (!key || typeof key !== "string") return null;
  const parts = key.split(".");
  if (parts.length < 2) return null;
  return {
    bookId: parts[0]!.toLowerCase(),
    chapter: parseInt(parts[1]!, 10),
    verse: parts[2] ? parseInt(parts[2], 10) : null,
  };
}

export function formatRef(key: string): string {
  const p = parseRefKey(key);
  if (!p) return key;
  return `${bookName(p.bookId)} ${p.chapter}${p.verse ? ":" + p.verse : ""}`;
}

export function navigateToRef(refKey: string): void {
  const display = formatRef(refKey);
  try {
    if (typeof dw().codexJumpToRef === "function") {
      dw().codexJumpToRef!(display);
    } else {
      const p = parseRefKey(refKey);
      if (p) {
        window.dispatchEvent(
          new CustomEvent("codex:navigate", {
            detail: {
              book: bookName(p.bookId),
              bookId: p.bookId,
              chapter: p.chapter,
              verse: p.verse,
            },
          }),
        );
      }
    }
  } catch { /* ignore */ }
}

export function kindLabel(kind: string | undefined | null): string {
  return (kind || "ENTRY").toUpperCase();
}

export function kindColor(kind: string | undefined | null): string {
  switch ((kind || "").toLowerCase()) {
    case "person":  return "#7ee0ff";
    case "place":   return "#ffc46b";
    case "concept": return "#c8a8ff";
    case "people":  return "#9be39c";
    default:        return "#c9d4dc";
  }
}

export function entryMatchesQuery(key: string, entry: DictEntry, q: string): number {
  if (!q) return 0;
  const ql = q.toLowerCase();
  const title = (entry.title || key).toLowerCase();
  if (title === ql) return 1000;
  if (title.startsWith(ql)) return 500 + (50 - Math.min(50, title.length));
  if (title.includes(ql)) return 200;
  if ((entry.related || []).some((r) => r.toLowerCase().includes(ql))) return 80;
  if ((entry.body || "").toLowerCase().includes(ql)) return 20;
  return 0;
}

// Build a proper-noun set from a chapter's verses, intersect with entry titles.
export function dictPicksForChapter(
  mod: DictModule,
  bookId: string,
  chapter: number,
  translation: string | undefined,
): string[] {
  try {
    const bible = dw().BIBLE;
    if (!mod || !bible || typeof bible.getCachedChapter !== "function") return [];
    const tr = translation || "kjv";
    const ch = bible.getCachedChapter(bookId, chapter, tr);
    if (!ch || !Array.isArray((ch as { verses?: unknown }).verses)) return [];
    const verses = (ch as { verses: Record<string, unknown>[] }).verses;
    const titleIndex = new Map<string, string>();
    for (const [key, ent] of Object.entries(mod.entries || {})) {
      titleIndex.set((ent.title || key).toLowerCase(), key);
    }
    const hits = new Map<string, number>(); // key -> count
    for (const v of verses) {
      const raw: unknown = v[tr] ?? v["text"];
      const text = raw ? String(raw) : "";
      if (!text) continue;
      // Pull capitalized tokens (proper nouns); ignore sentence-start ambiguity by
      // only counting tokens 3+ chars long.
      const tokens = text.match(/\b[A-Z][a-z]{2,}\b/g) || [];
      for (const t of tokens) {
        const key = titleIndex.get(t.toLowerCase());
        if (key) hits.set(key, (hits.get(key) || 0) + 1);
      }
    }
    return [...hits.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([k]) => k);
  } catch {
    return [];
  }
}
