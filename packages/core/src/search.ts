// Full-text scripture search — pure in-memory engine ported from search.js.
//
// The original mixed an inverted-index search with IndexedDB persistence, a
// lazy seed from the codex DB, and a React SearchBar. Here the engine is pure
// and synchronous (docs + inverted index in memory); persistence/seeding and
// the UI stay in the platform/web layer. "recent translation" weighting is
// injected via search opts instead of read from localStorage.

import { bookById } from "./data.js";

export interface ParsedQuery {
  tokens: string[];
  wildcards: string[];
  phrases: string[];
  translation: string | null;
}

export interface PrettyRef {
  bookName: string;
  bookId: string;
  chapter: number;
  verse: number;
  label: string;
}

export interface SearchResult {
  ref: string;
  translation: string;
  snippet: string;
  score: number;
  text: string;
  pretty: PrettyRef;
}

export interface SearchOpts {
  limit?: number;
  /** translations to weight up (e.g. the user's primary) */
  recent?: Set<string>;
}

interface Doc {
  id: number;
  ref: string;
  translation: string;
  text: string;
  tokensLower: string[];
}

// Lowercase, normalize quotes, strip non-alphanumerics (keep apostrophes + *).
export function tokenize(s: string): string[] {
  if (!s) return [];
  return String(s)
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^\p{L}\p{N}'\s*]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

// Supports plain words, "phrase", trailing-* wildcard, and @TRANS filter.
export function parseQuery(q: string): ParsedQuery {
  const out: ParsedQuery = { tokens: [], wildcards: [], phrases: [], translation: null };
  if (!q) return out;
  let rest = String(q).trim();
  const trMatch = rest.match(/(^|\s)@([A-Za-z0-9_-]+)/);
  if (trMatch) {
    out.translation = (trMatch[2] ?? "").toLowerCase();
    const idx = trMatch.index ?? 0;
    rest = (rest.slice(0, idx) + rest.slice(idx + trMatch[0].length)).trim();
  }
  rest = rest.replace(/"([^"]+)"/g, (_m, p: string) => {
    out.phrases.push(p.toLowerCase().trim());
    return " ";
  });
  for (const tk of tokenize(rest)) {
    if (tk.endsWith("*") && tk.length > 1) out.wildcards.push(tk.slice(0, -1));
    else out.tokens.push(tk);
  }
  return out;
}

export function prettyRef(ref: string): PrettyRef {
  const parts = ref.split(".");
  const verse = parts.pop() ?? "";
  const chapter = parts.pop() ?? "";
  const bookId = parts.join(".");
  const book = bookById(bookId);
  const bookName = book ? book.name : bookId;
  return { bookName, bookId, chapter: Number(chapter), verse: Number(verse), label: `${bookName} ${chapter}:${verse}` };
}

function escapeHTML(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    switch (c) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return c;
    }
  });
}

export function snippet(text: string, hits: string[]): string {
  if (!text) return "";
  const WINDOW = 80;
  const lowered = text.toLowerCase();
  let pos = -1;
  for (const h of hits) {
    const p = lowered.indexOf(h);
    if (p >= 0 && (pos < 0 || p < pos)) pos = p;
  }
  if (pos < 0) {
    const head = text.slice(0, WINDOW);
    return escapeHTML(head) + (text.length > WINDOW ? "…" : "");
  }
  const start = Math.max(0, pos - 30);
  const end = Math.min(text.length, pos + WINDOW);
  const snip = text.slice(start, end);
  const lowSnip = snip.toLowerCase();
  const ranges: Array<[number, number]> = [];
  for (const h of hits) {
    if (!h) continue;
    let from = 0;
    for (;;) {
      const idx = lowSnip.indexOf(h, from);
      if (idx < 0) break;
      ranges.push([idx, idx + h.length]);
      from = idx + h.length;
    }
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last && r[0] <= last[1]) last[1] = Math.max(last[1], r[1]);
    else merged.push([r[0], r[1]]);
  }
  let out = "";
  let cursor = 0;
  for (const [a, b] of merged) {
    out += escapeHTML(snip.slice(cursor, a));
    out += "<mark>" + escapeHTML(snip.slice(a, b)) + "</mark>";
    cursor = b;
  }
  out += escapeHTML(snip.slice(cursor));
  return (start > 0 ? "…" : "") + out + (end < text.length ? "…" : "");
}

export interface VerseLike {
  n?: number;
  text?: string;
  [key: string]: unknown;
}

export interface Passage {
  bookId: string;
  chapter: number | string;
  verses: VerseLike[];
  primary?: string;
}

export interface SearchIndex {
  addDoc(ref: string, translation: string, text: string): void;
  index(translation: string, refsObject: Record<string, Array<{ n: number; text?: string | null }>>): number;
  ingestPassage(passage: Passage): number;
  search(query: string, opts?: SearchOpts): SearchResult[];
  clear(): void;
  stats(): { translations: number; translationList: string[]; verses: number; built: boolean };
}

export function createSearchIndex(): SearchIndex {
  const docs: Doc[] = [];
  const byKey = new Map<string, number>();
  const inverted = new Map<string, Set<number>>();
  let built = false;

  function addDoc(ref: string, translation: string, text: string): void {
    if (!text || typeof text !== "string") return;
    const dedup = translation + "|" + ref;
    if (byKey.has(dedup)) return;
    const id = docs.length;
    const tokensLower = tokenize(text);
    docs.push({ id, ref, translation, text, tokensLower });
    byKey.set(dedup, id);
    if (built) {
      for (const tk of tokensLower) {
        let s = inverted.get(tk);
        if (!s) {
          s = new Set();
          inverted.set(tk, s);
        }
        s.add(id);
      }
    }
  }

  function buildInverted(): void {
    inverted.clear();
    for (const d of docs) {
      for (const tk of d.tokensLower) {
        let s = inverted.get(tk);
        if (!s) {
          s = new Set();
          inverted.set(tk, s);
        }
        s.add(d.id);
      }
    }
    built = true;
  }

  function index(translation: string, refsObject: Record<string, Array<{ n: number; text?: string | null }>>): number {
    if (!translation || !refsObject) return 0;
    let added = 0;
    for (const [bookCh, verses] of Object.entries(refsObject)) {
      if (!Array.isArray(verses)) continue;
      for (const v of verses) {
        if (!v || v.text == null) continue;
        const before = docs.length;
        addDoc(`${bookCh}.${v.n}`, translation, String(v.text));
        if (docs.length > before) added++;
      }
    }
    return added;
  }

  function ingestPassage(passage: Passage): number {
    if (!passage || !passage.bookId || !passage.verses) return 0;
    const bookCh = `${passage.bookId}.${passage.chapter}`;
    let added = 0;
    for (const v of passage.verses) {
      if (!v || v.n == null) continue;
      const ref = `${bookCh}.${v.n}`;
      for (const [k, val] of Object.entries(v)) {
        if (k === "n" || k === "red" || k === "_jesusVerse" || k === "text") continue;
        if (typeof val !== "string") continue;
        const before = docs.length;
        addDoc(ref, k, val);
        if (docs.length > before) added++;
      }
      if (typeof v.text === "string") {
        const before = docs.length;
        addDoc(ref, passage.primary || "default", v.text);
        if (docs.length > before) added++;
      }
    }
    return added;
  }

  function matchWildcard(prefix: string): Set<number> {
    const set = new Set<number>();
    for (const tk of inverted.keys()) {
      if (tk.startsWith(prefix)) for (const id of inverted.get(tk) ?? []) set.add(id);
    }
    return set;
  }

  function search(query: string, opts: SearchOpts = {}): SearchResult[] {
    if (!built) buildInverted();
    const q = parseQuery(query);
    const allTokens = [...q.tokens];
    const hits = [...q.tokens, ...q.wildcards, ...q.phrases];
    if (!allTokens.length && !q.wildcards.length && !q.phrases.length) return [];

    let candidates: Set<number> | null = null;
    function intersect(set: Set<number>): void {
      if (candidates === null) {
        candidates = new Set(set);
        return;
      }
      const next = new Set<number>();
      for (const id of candidates) if (set.has(id)) next.add(id);
      candidates = next;
    }
    for (const tk of q.tokens) intersect(inverted.get(tk) ?? new Set());
    for (const w of q.wildcards) intersect(matchWildcard(w));
    for (const p of q.phrases) {
      const firstTk = tokenize(p)[0];
      if (firstTk) intersect(inverted.get(firstTk) ?? new Set());
    }
    let cands: Set<number> = candidates ?? new Set();

    let mode: "all" | "some" = "all";
    if (cands.size === 0 && q.tokens.length + q.wildcards.length > 1) {
      mode = "some";
      cands = new Set();
      for (const tk of q.tokens) for (const id of inverted.get(tk) ?? []) cands.add(id);
      for (const w of q.wildcards) for (const id of matchWildcard(w)) cands.add(id);
    }

    const recent = opts.recent ?? new Set<string>();
    const results: SearchResult[] = [];
    for (const id of cands) {
      const d = docs[id];
      if (!d) continue;
      if (q.translation && d.translation.toLowerCase() !== q.translation) continue;
      const lower = d.text.toLowerCase();
      let phraseScore = 0;
      let phraseFail = false;
      for (const p of q.phrases) {
        if (lower.indexOf(p) < 0) {
          phraseFail = true;
          break;
        }
        phraseScore += 4;
      }
      if (phraseFail) continue;

      let score = mode === "all" ? 10 : 4;
      for (const tk of q.tokens) if (lower.indexOf(tk) >= 0) score += 1;
      for (const w of q.wildcards) if (lower.indexOf(w) >= 0) score += 0.5;
      score += phraseScore;
      if (q.tokens.length > 1 && lower.indexOf(q.tokens.join(" ")) >= 0) score += 5;
      if (recent.has(d.translation)) score += 2;

      results.push({
        ref: d.ref,
        translation: d.translation,
        snippet: snippet(d.text, hits),
        score,
        text: d.text,
        pretty: prettyRef(d.ref),
      });
    }
    results.sort((a, b) => b.score - a.score || a.ref.localeCompare(b.ref));
    return results.slice(0, opts.limit || 20);
  }

  function clear(): void {
    docs.length = 0;
    byKey.clear();
    inverted.clear();
    built = false;
  }

  function stats(): { translations: number; translationList: string[]; verses: number; built: boolean } {
    const trans = new Set<string>();
    for (const d of docs) trans.add(d.translation);
    return { translations: trans.size, translationList: [...trans], verses: docs.length, built };
  }

  return { addDoc, index, ingestPassage, search, clear, stats };
}
