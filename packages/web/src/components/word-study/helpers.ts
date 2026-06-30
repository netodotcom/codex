// word-study — helpers (migrated faithfully from word-study.jsx). Pure helpers
// (lsGet, lsSet, extractJson, splitSemanticRange, parseRef) are ground-truth
// tested; helpers that read window globals go through wsw(). AI-fetching helpers
// (chat, fetchRelated, fetchTheology) and frequencyFor are faithful ports of the
// legacy IIFE functions.

import { wsw } from "./word-study-window.js";
import type { WsStrongsEntry, WsSearchResult } from "./word-study-window.js";

// ── Constants ────────────────────────────────────────────────────────────────
export const LS_LAST = "codex.wordstudy.last";
export const LS_AI_PREFIX = "codex.wordstudy."; // codex.wordstudy.G25 etc.
export const AI_TTL_MS = 30 * 24 * 60 * 60 * 1000;

// ── localStorage helpers ──────────────────────────────────────────────────────
export function lsGet<T>(k: string, fb: T): T {
  try {
    const v = localStorage.getItem(k);
    return v == null ? fb : (JSON.parse(v) as T);
  } catch {
    return fb;
  }
}

export function lsSet(k: string, v: unknown): void {
  try {
    localStorage.setItem(k, JSON.stringify(v));
  } catch {}
}

// ── Depth event emitter ───────────────────────────────────────────────────────
// Guarded depth-action emit. No-op if the event API is unavailable (Lite mode)
// or required fields are missing. Only emit depth types known to engagement.js.
export function emitDepth(type: string, ref: string, weight: number): void {
  try {
    if (!type || typeof window.dispatchEvent !== "function" || typeof window.CustomEvent !== "function") return;
    window.dispatchEvent(new CustomEvent("codex:depth-action", {
      detail: { type, ref, weight },
    }));
  } catch {}
}

// ── AI config ────────────────────────────────────────────────────────────────
export function getTweaks(): { provider?: string; model?: string } {
  return wsw().CODEX_DATA?.tweaks ?? {};
}

export function hasAiKey(): boolean {
  const t = getTweaks();
  return !!(t.provider || t.model);
}

// ── JSON extraction ───────────────────────────────────────────────────────────
export function extractJson(text: unknown): unknown {
  if (!text) return null;
  const s = String(text).trim()
    .replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "");
  try { return JSON.parse(s); } catch {}
  const m = s.match(/\{[\s\S]*\}/);
  if (m && m[0]) { try { return JSON.parse(m[0]); } catch {} }
  return null;
}

// ── Book name lookup ──────────────────────────────────────────────────────────
export function bookName(bookId: string): string {
  try {
    const books = wsw().CODEX_DATA?.books ?? [];
    const bk = books.find((b) => b.id === bookId);
    if (bk) return bk.name;
  } catch {}
  return bookId;
}

// ── Reference parser ──────────────────────────────────────────────────────────
export function parseRef(ref: string): { bookId: string; chapter: number; verse: number } {
  const parts = String(ref || "").split(".");
  const vStr = parts.pop();
  const cStr = parts.pop();
  const b = parts.join(".");
  return { bookId: b, chapter: Number(cStr), verse: Number(vStr) };
}

// ── Navigation ────────────────────────────────────────────────────────────────
export function navigate(bookId: string, chapter: number, verse: number): void {
  try {
    const name = bookName(bookId);
    const jump = wsw().codexJumpToRef;
    if (typeof jump === "function") {
      jump(name + " " + chapter + ":" + verse);
      return;
    }
    window.dispatchEvent(new CustomEvent("codex:navigate", {
      detail: { book: name, bookId, chapter, verse },
    }));
  } catch {}
}

// ── Strong's lookup ───────────────────────────────────────────────────────────
export function lookup(strongs: string): WsStrongsEntry | null {
  if (!strongs) return null;
  try {
    const fn = wsw().CODEX_StrongsLookup;
    if (typeof fn === "function") {
      return fn(strongs) ?? null;
    }
  } catch {}
  return null;
}

// ── Semantic range splitter ───────────────────────────────────────────────────
// Best-guess: split a Strong's "def" string into bullets at semicolons /
// numeric markers / colons. Falls back to a single bullet.
export function splitSemanticRange(def: unknown): string[] {
  if (!def) return [];
  const raw = String(def).trim();
  // Try numbered patterns like "1) X 2) Y 3) Z"
  const nums = raw.split(/\s*\d+\)\s*/).map((s) => s.trim()).filter(Boolean);
  if (nums.length >= 2) return nums;
  const parts = raw.split(/\s*;\s*/).map((s) => s.trim()).filter(Boolean);
  if (parts.length >= 2) return parts;
  return [raw];
}

// ── AI cache ──────────────────────────────────────────────────────────────────
export interface RelatedItem {
  word?: string;
  term?: string;
  strongs?: string;
  meaning?: string;
  gloss?: string;
}

export interface RelatedData {
  related?: RelatedItem[];
  hebrew_counterparts?: RelatedItem[];
  antonyms?: RelatedItem[];
}

export interface AiData {
  related?: RelatedData | null;
  theology?: string | null;
}

interface AiCacheEntry {
  ts: number;
  data: AiData;
}

export function aiCacheGet(strongs: string): AiData | null {
  const c = lsGet<AiCacheEntry | null>(LS_AI_PREFIX + strongs, null);
  if (!c || !c.ts || Date.now() - c.ts > AI_TTL_MS) return null;
  return c.data || null;
}

export function aiCacheSet(strongs: string, data: AiData): void {
  lsSet(LS_AI_PREFIX + strongs, { ts: Date.now(), data });
}

// ── AI chat ───────────────────────────────────────────────────────────────────
interface ChatResponse {
  text?: string;
  error?: string;
}

export function chat(system: string, user: string, maxTokens?: number): Promise<ChatResponse> {
  const t = getTweaks();
  return fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider: t.provider,
      model: t.model,
      system,
      messages: [{ role: "user", content: user }],
      max_tokens: maxTokens || 700,
    }),
  }).then((r) => r.json() as Promise<ChatResponse>);
}

// ── AI fetchers ───────────────────────────────────────────────────────────────
export function fetchRelated(strongs: string, word: string): Promise<RelatedData> {
  const sys = "You are a biblical lexicographer. Return JSON only.";
  const user = 'For the word "' + (word || "") + '" (' + strongs + "), list:\n"
    + "- 3-5 related Greek words with their Strong's numbers and brief meanings\n"
    + "- 3-5 Hebrew counterparts with their Strong's numbers\n"
    + "- Any conceptual antonyms\n"
    + "Return JSON only:\n"
    + '{ "related": [{ "word": "...", "strongs": "...", "meaning": "..." }],\n'
    + '  "hebrew_counterparts": [...],\n'
    + '  "antonyms": [...] }';
  return chat(sys, user, 800).then((d) => {
    if (!d || !d.text) throw new Error((d && d.error) || "No response");
    const j = extractJson(d.text) as RelatedData | null;
    if (!j) throw new Error("Bad JSON");
    return j;
  });
}

export function fetchTheology(strongs: string, word: string, gloss: string): Promise<string> {
  const sys = "You are a biblical theologian. Write one tight paragraph (110-160 words), plain prose, no headings, no bullets. Scripture-faithful, ecumenical.";
  const user = 'Why does the biblical word "' + (word || "") + '" (' + strongs + (gloss ? ", gloss: " + gloss : "") + ") matter theologically? Trace its weight in the canon in one paragraph.";
  return chat(sys, user, 500).then((d) => {
    if (!d || !d.text) throw new Error((d && d.error) || "No response");
    return String(d.text).trim();
  });
}

// ── Frequency over user library ───────────────────────────────────────────────
export interface FreqResult {
  total: number;
  byBook: Array<{ bookId: string; name: string; count: number }>;
  hits: WsSearchResult[];
}

export function frequencyFor(word: string): Promise<FreqResult> {
  const searchApi = wsw().CODEX_SEARCH;
  if (!word || !searchApi || typeof searchApi.search !== "function") {
    return Promise.resolve({ total: 0, byBook: [], hits: [] });
  }
  let p: ReturnType<typeof searchApi.search>;
  try {
    p = searchApi.search(word, { limit: 500 });
  } catch {
    return Promise.resolve({ total: 0, byBook: [], hits: [] });
  }
  return Promise.resolve(p).then(
    (results) => {
      const arr: WsSearchResult[] = Array.isArray(results)
        ? results
        : ((results as { results?: WsSearchResult[] }).results ?? []);
      const counts: Record<string, number> = {};
      arr.forEach((r) => {
        const ref = r.ref || r.id || "";
        const parts = ref.split(".");
        if (parts.length >= 3) {
          const bookId = parts.slice(0, -2).join(".");
          counts[bookId] = (counts[bookId] ?? 0) + 1;
        }
      });
      const byBook = Object.keys(counts).map((b) => ({
        bookId: b,
        name: bookName(b),
        count: counts[b] ?? 0,
      })).sort((a, b) => b.count - a.count);
      return { total: arr.length, byBook, hits: arr };
    },
    () => ({ total: 0, byBook: [], hits: [] }),
  );
}
