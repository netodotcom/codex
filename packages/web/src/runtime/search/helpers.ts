// search — index/query logic (faithful port from legacy/search.js).
// Same IDB schema, tokenizer, inverted-index, ranking, persistence and
// semantic search behaviour as the v1 IIFE.  Module-level state mirrors
// the IIFE closure; exported functions form the CODEX_SEARCH public API.
import type {
  SearchDoc, StoredDoc, Passage, PrettyRef, SearchResult,
  ParsedQuery, SearchOpts, SemanticSearchResult, SemanticSearchOpts,
  SearchStats, ConceptResult, RawSemanticItem, TweaksBlob,
  ConceptCacheEntry, ParsedHumanRef,
} from "./types.js";
import { sw } from "./search-window.js";

const DB_NAME  = "codex-search";
const STORE    = "docs";
const META_KEY = "__meta__";

// ── In-memory state ───────────────────────────────────────────────────────────
const docs: SearchDoc[] = [];                      // { id, ref, translation, text, tokensLower }
const byKey = new Map<string, number>();            // dedup key "translation|ref" → docId
const inverted = new Map<string, Set<number>>();   // token → Set<docId>
let built = false;                                  // inverted index built?
let indexedAt = 0;
let _db: IDBDatabase | null = null;
let _seeded = false;                               // did we read the codex chapters store yet?

// ── IDB helpers (self-contained) ──────────────────────────────────────────────
function _openSelfDB(): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (!sw().indexedDB) { reject(new Error("no idb")); return; }
    const r = indexedDB.open(DB_NAME, 1);
    r.onupgradeneeded = (e: IDBVersionChangeEvent) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    r.onsuccess = () => resolve(r.result);
    r.onerror   = () => reject(r.error);
  });
}

// NOTE: preserved from legacy — op returns the IDBRequest to await (onsuccess),
// or null to let the transaction's oncomplete fire (e.g. bulk puts).
function _idb(
  store: string,
  mode: IDBTransactionMode,
  op: (s: IDBObjectStore) => IDBRequest | null,
): Promise<unknown> {
  return new Promise<unknown>((resolve, reject) => {
    if (!_db) { reject(new Error("db closed")); return; }
    const tx = _db.transaction(store, mode);
    const s = tx.objectStore(store);
    const r = op(s);
    if (r !== null && "onsuccess" in r) {
      r.onsuccess = () => resolve(r.result as unknown);
      r.onerror   = () => reject(r.error);
    } else {
      tx.oncomplete = () => resolve(undefined);
      tx.onerror    = () => reject(tx.error);
    }
  });
}

// ── Read from the codex (bible.js) IDB to seed docs ──────────────────────────
interface _ChapterRecord {
  bookId: string;
  chapter: number;
  translation: string;
  verses: Array<{ n?: number | string | undefined; text?: string | null | undefined } | null | undefined>;
}

function _readCodexChapters(): Promise<_ChapterRecord[]> {
  return new Promise<_ChapterRecord[]>((resolve) => {
    try {
      const req = indexedDB.open("codex");
      req.onsuccess = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("chapters")) { db.close(); resolve([]); return; }
        const out: _ChapterRecord[] = [];
        const tx = db.transaction("chapters", "readonly");
        const cur = tx.objectStore("chapters").openCursor();
        cur.onsuccess = (e: Event) => {
          const c = (e.target as IDBRequest<IDBCursorWithValue | null>).result;
          if (c) {
            // key = "bookId.chapter.translation"; value = {verses, translation, ...}
            const key = c.key;
            const v = c.value as { verses?: unknown } | undefined;
            const parts = String(key).split(".");
            const translation = parts.pop() ?? "";
            const chapterStr  = parts.pop() ?? "0";
            const bookId      = parts.join(".");
            const verses = (v !== undefined && v !== null && Array.isArray(v.verses))
              ? v.verses as _ChapterRecord["verses"]
              : [];
            out.push({ bookId, chapter: Number(chapterStr), translation, verses });
            c.continue();
          } else { db.close(); resolve(out); }
        };
        cur.onerror = () => { db.close(); resolve(out); };
      };
      req.onerror = () => resolve([]);
    } catch { resolve([]); }
  });
}

// ── Tokenization ──────────────────────────────────────────────────────────────
// Lowercase, strip non-alphanum (keep apostrophes inside words), split on ws.
export function tokenize(s: string): string[] {
  if (!s) return [];
  return String(s)
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^\p{L}\p{N}'\s*]/gu, " ")
    .split(/\s+/)
    .filter(Boolean);
}

// ── Doc add / index build ─────────────────────────────────────────────────────
function _addDoc(ref: string, translation: string, text: string): void {
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
      if (s === undefined) { s = new Set<number>(); inverted.set(tk, s); }
      s.add(id);
    }
  }
}

function _buildInverted(): void {
  inverted.clear();
  for (const d of docs) {
    for (const tk of d.tokensLower) {
      let s = inverted.get(tk);
      if (s === undefined) { s = new Set<number>(); inverted.set(tk, s); }
      s.add(d.id);
    }
  }
  built = true;
  indexedAt = Date.now();
}

// ── Persistence ───────────────────────────────────────────────────────────────
let _persistTimer: ReturnType<typeof setTimeout> | null = null;

function _schedulePersist(): void {
  if (_persistTimer !== null) return;
  _persistTimer = setTimeout(() => { _persistTimer = null; void _persist(); }, 800);
}

async function _persist(): Promise<void> {
  if (!_db) return;
  try {
    await _idb(STORE, "readwrite", (s) => {
      s.clear();
      for (const d of docs) {
        // Persist minimal — re-tokenize on rebuild.
        s.put({ ref: d.ref, translation: d.translation, text: d.text }, d.id);
      }
      s.put({ indexedAt, count: docs.length, v: 1 }, META_KEY);
      return null;
    });
  } catch { /* ignore */ }
}

async function _loadPersisted(): Promise<boolean> {
  if (!_db) return false;
  try {
    const all = await new Promise<StoredDoc[]>((resolve, reject) => {
      if (!_db) { resolve([]); return; }
      const tx = _db.transaction(STORE, "readonly");
      const store = tx.objectStore(STORE);
      const out: StoredDoc[] = [];
      const cur = store.openCursor();
      cur.onsuccess = (e: Event) => {
        const c = (e.target as IDBRequest<IDBCursorWithValue | null>).result;
        if (c) {
          if (c.key !== META_KEY) out.push(c.value as StoredDoc);
          c.continue();
        } else resolve(out);
      };
      cur.onerror = () => reject(cur.error);
    });
    if (!all.length) return false;
    for (const d of all) _addDoc(d.ref, d.translation, d.text);
    return true;
  } catch { return false; }
}

// ── Public ingest ─────────────────────────────────────────────────────────────
export function index(translation: string, refsObject: Record<string, unknown[]>): number | undefined {
  if (!translation || !refsObject) return;
  let added = 0;
  for (const [bookCh, verses] of Object.entries(refsObject)) {
    if (!Array.isArray(verses)) continue;
    for (const v of verses) {
      if (v === null || v === undefined) continue;
      const vRec = v as { n?: unknown; text?: unknown };
      if (vRec.text == null) continue;
      const ref = `${bookCh}.${String(vRec.n ?? "")}`;
      const before = docs.length;
      _addDoc(ref, translation, String(vRec.text));
      if (docs.length > before) added++;
    }
  }
  if (added) _schedulePersist();
  return added;
}

export function ingestPassage(passage: Passage): number {
  if (!passage || !passage.bookId || !passage.verses) return 0;
  const bookCh = `${passage.bookId}.${passage.chapter}`;
  let added = 0;
  for (const v of passage.verses) {
    if (v === null || v === undefined) continue;
    if (v.n == null) continue;
    const ref = `${bookCh}.${String(v.n)}`;
    // A verse object from loadMulti has { n, [translationId]: text, ... }
    for (const [k, val] of Object.entries(v)) {
      if (k === "n" || k === "red" || k === "_jesusVerse" || k === "text") continue;
      if (typeof val !== "string") continue;
      const before = docs.length;
      _addDoc(ref, k, val);
      if (docs.length > before) added++;
    }
    // Fallback to v.text + a default translation tag if no per-translation keys.
    if (typeof v.text === "string") {
      const before = docs.length;
      _addDoc(ref, passage.primary ?? "default", v.text);
      if (docs.length > before) added++;
    }
  }
  if (added) _schedulePersist();
  return added;
}

// ── Lazy seed from codex IDB on first search() ────────────────────────────────
async function _seedIfNeeded(): Promise<void> {
  if (_seeded) return;
  _seeded = true;
  const chapters = await _readCodexChapters();
  for (const ch of chapters) {
    for (const v of ch.verses) {
      if (v === null || v === undefined) continue;
      if (v.text == null) continue;
      const ref = `${ch.bookId}.${ch.chapter}.${String(v.n ?? "")}`;
      _addDoc(ref, ch.translation, String(v.text));
    }
  }
  if (chapters.length) _schedulePersist();
}

// ── Query parsing ─────────────────────────────────────────────────────────────
// Supports: plain words, "phrase", trailing * wildcard, @TRANS filter.
export function parseQuery(q: string): ParsedQuery {
  const out: ParsedQuery = { tokens: [], wildcards: [], phrases: [], translation: null };
  if (!q) return out;
  let rest = String(q).trim();
  // @TRANS prefix
  const trMatch = rest.match(/(^|\s)@([A-Za-z0-9_-]+)/);
  if (trMatch) {
    out.translation = (trMatch[2] ?? "").toLowerCase();
    const matchIndex = trMatch.index ?? 0;
    const matchLen   = (trMatch[0] ?? "").length;
    rest = (rest.slice(0, matchIndex) + rest.slice(matchIndex + matchLen)).trim();
  }
  // Extract quoted phrases
  rest = rest.replace(/"([^"]+)"/g, (_, p: string) => {
    out.phrases.push(p.toLowerCase().trim());
    return " ";
  });
  for (const tk of tokenize(rest)) {
    if (tk.endsWith("*") && tk.length > 1) out.wildcards.push(tk.slice(0, -1));
    else out.tokens.push(tk);
  }
  return out;
}

function _matchWildcard(prefix: string): Set<number> {
  const set = new Set<number>();
  for (const tk of inverted.keys()) {
    if (tk.startsWith(prefix)) {
      const ids = inverted.get(tk);
      if (ids !== undefined) for (const id of ids) set.add(id);
    }
  }
  return set;
}

// ── bookId pretty-print for ref label ────────────────────────────────────────
function _prettyRef(ref: string): PrettyRef {
  // ref shape: "bookId.chapter.verse"
  const parts = ref.split(".");
  const verseStr   = parts.pop() ?? "0";
  const chapterStr = parts.pop() ?? "0";
  const bookId     = parts.join(".");
  let bookName = bookId;
  try {
    const book = (sw().CODEX_DATA?.books ?? []).find(b => b.id === bookId);
    if (book) bookName = book.name;
  } catch { /* ignore */ }
  return {
    bookName,
    bookId,
    chapter: Number(chapterStr),
    verse:   Number(verseStr),
    label:   `${bookName} ${chapterStr}:${verseStr}`,
  };
}

// ── Snippet with <mark> highlight ─────────────────────────────────────────────
function _escapeHTML(s: string): string {
  return s.replace(/[&<>"']/g, (c) => {
    const map: Record<string, string> = {
      "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;",
    };
    return map[c] ?? c;
  });
}

export function snippet(text: string, hits: string[]): string {
  if (!text) return "";
  const WINDOW = 80;
  const lowered = text.toLowerCase();
  // pick first hit position
  let pos = -1;
  for (const h of hits) {
    const p = lowered.indexOf(h);
    if (p >= 0 && (pos < 0 || p < pos)) pos = p;
  }
  if (pos < 0) {
    const head = text.slice(0, WINDOW);
    return _escapeHTML(head) + (text.length > WINDOW ? "…" : "");
  }
  const start = Math.max(0, pos - 30);
  const end   = Math.min(text.length, pos + WINDOW);
  const snip  = text.slice(start, end);
  let safeOut = "";
  let cursor  = 0;
  const lowSnip = snip.toLowerCase();
  // Build sorted match ranges within snippet
  const ranges: [number, number][] = [];
  for (const h of hits) {
    if (!h) continue;
    let from = 0;
    while (true) {
      const idx = lowSnip.indexOf(h, from);
      if (idx < 0) break;
      ranges.push([idx, idx + h.length]);
      from = idx + h.length;
    }
  }
  ranges.sort((a, b) => a[0] - b[0]);
  // Merge overlaps
  const merged: [number, number][] = [];
  for (const r of ranges) {
    const last = merged[merged.length - 1];
    if (last !== undefined && r[0] <= last[1]) {
      last[1] = Math.max(last[1], r[1]);
    } else {
      merged.push([r[0], r[1]]);
    }
  }
  for (const [a, b] of merged) {
    safeOut += _escapeHTML(snip.slice(cursor, a));
    safeOut += "<mark>" + _escapeHTML(snip.slice(a, b)) + "</mark>";
    cursor = b;
  }
  safeOut += _escapeHTML(snip.slice(cursor));
  return (start > 0 ? "…" : "") + safeOut + (end < text.length ? "…" : "");
}

// ── Recent-translation weight: read app primary if available ──────────────────
// The primary translation lives in the tweaks blob (codex.tweaks.v1 →
// primaryTranslation); the bare "codex.primary" key was never written.
function _recentTranslations(): Set<string> {
  try {
    // NOTE: preserved from legacy — `||` (not ??) so empty-string primaryTranslation
    // falls through to the localStorage fallback, matching v1 behaviour.
    const tweaks = JSON.parse(localStorage.getItem("codex.tweaks.v1") || "{}") as TweaksBlob | null;
    const primary = tweaks?.primaryTranslation || localStorage.getItem("codex.primary");
    return primary ? new Set([String(primary).replace(/^"|"$/g, "")]) : new Set<string>();
  } catch { return new Set<string>(); }
}

// ── search ────────────────────────────────────────────────────────────────────
export async function search(query: string, opts: SearchOpts = {}): Promise<SearchResult[]> {
  if (!_seeded) await _seedIfNeeded();
  if (!built) _buildInverted();
  const q = parseQuery(query);
  const hits = [...q.tokens, ...q.wildcards, ...q.phrases];
  if (!q.tokens.length && !q.wildcards.length && !q.phrases.length) return [];

  // Candidate doc set: intersection of all required tokens; fallback to union.
  let candidates: Set<number> | null = null;

  function intersect(set: Set<number>): void {
    if (candidates === null) { candidates = new Set<number>(set); return; }
    const next = new Set<number>();
    for (const id of candidates) if (set.has(id)) next.add(id);
    candidates = next;
  }

  for (const tk of q.tokens) {
    intersect(inverted.get(tk) ?? new Set<number>());
  }
  for (const w of q.wildcards) intersect(_matchWildcard(w));
  // Phrases require post-filter (we filter below); also intersect on the
  // first token of each phrase for quick prune.
  for (const p of q.phrases) {
    const firstTk = tokenize(p)[0];
    if (firstTk !== undefined) intersect(inverted.get(firstTk) ?? new Set<number>());
  }
  if (candidates === null) candidates = new Set<number>();

  // Fallback: if intersection empty, look for ANY token (some-match).
  let mode: "all" | "some" = "all";
  if (candidates.size === 0 && (q.tokens.length + q.wildcards.length) > 1) {
    mode = "some";
    candidates = new Set<number>();
    for (const tk of q.tokens) {
      const ids = inverted.get(tk);
      if (ids !== undefined) for (const id of ids) (candidates as Set<number>).add(id);
    }
    for (const w of q.wildcards) {
      for (const id of _matchWildcard(w)) (candidates as Set<number>).add(id);
    }
  }

  const recent  = _recentTranslations();
  const results: SearchResult[] = [];

  for (const id of candidates) {
    const d = docs[id];
    if (d === undefined) continue;   // guard for noUncheckedIndexedAccess
    if (q.translation !== null && d.translation.toLowerCase() !== q.translation) continue;
    const lower = d.text.toLowerCase();
    // Phrase filter
    let phraseScore = 0;
    let phraseFail  = false;
    for (const p of q.phrases) {
      if (lower.indexOf(p) < 0) { phraseFail = true; break; }
      phraseScore += 4;
    }
    if (phraseFail) continue;

    // Score
    let score = (mode === "all" ? 10 : 4);
    for (const tk of q.tokens) {
      if (lower.indexOf(tk) >= 0) score += 1;
    }
    for (const w of q.wildcards) {
      if (lower.indexOf(w) >= 0) score += 0.5;
    }
    score += phraseScore;
    // Contiguity: if all tokens appear in order close together, bonus.
    if (q.tokens.length > 1) {
      const joined = q.tokens.join(" ");
      if (lower.indexOf(joined) >= 0) score += 5;
    }
    if (recent.has(d.translation)) score += 2;

    results.push({
      ref:        d.ref,
      translation: d.translation,
      snippet:    snippet(d.text, hits),
      score,
      text:       d.text,
      pretty:     _prettyRef(d.ref),
    });
  }

  results.sort((a, b) => b.score - a.score || a.ref.localeCompare(b.ref));
  try { sw().CODEX_ENGAGE?.trackSearch(); } catch { /* ignore */ }
  const limit = opts.limit ?? 20;
  return results.slice(0, limit);
}

export function clear(): void {
  docs.length = 0;
  byKey.clear();
  inverted.clear();
  built    = false;
  indexedAt = 0;
  _seeded  = false;
  if (_db) _idb(STORE, "readwrite", s => s.clear()).catch(() => { /* ignore */ });
}

export function stats(): SearchStats {
  const trans = new Set<string>();
  for (const d of docs) trans.add(d.translation);
  return {
    translations:     trans.size,
    translationList:  [...trans],
    verses:           docs.length,
    indexedAt,
    built,
  };
}

// ── Init: open self DB, load persisted docs (if any) ──────────────────────────
export const ready: Promise<void> = (async (): Promise<void> => {
  try {
    _db = await _openSelfDB();
    const had = await _loadPersisted();
    if (had) _seeded = true;    // skip codex re-scan; we have docs already
  } catch { /* ignore */ }
})();

// ── Semantic (concept) search ─────────────────────────────────────────────────
// AI-powered. POSTs the query to /api/chat asking for a JSON array of
// relevant passages. Cached per (query, lang) in localStorage so repeats
// are instant + work offline.
function _hashStr(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(36);
}

function _lang(): string {
  // NOTE: preserved from legacy — `||` so empty string from codexLangName()
  // also falls back to "English".
  try { return sw().codexLangName?.() || "English"; }
  catch { return "English"; }
}

function _tweaks(): TweaksBlob {
  // NOTE: preserved from legacy — trailing `|| {}` guards against JSON.parse("null").
  try {
    return (JSON.parse(localStorage.getItem("codex.tweaks.v1") || "{}") as TweaksBlob | null) || {};
  }
  catch { return {}; }
}

function _conceptCacheKey(query: string, lang: string): string {
  return `codex.search.concept.${_hashStr(query.trim().toLowerCase())}.${lang}`;
}

function _readConceptCache(query: string, lang: string): ConceptCacheEntry | null {
  try {
    const raw = localStorage.getItem(_conceptCacheKey(query, lang));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ConceptCacheEntry | null;
    if (!parsed || !Array.isArray(parsed.results)) return null;
    return parsed;
  } catch { return null; }
}

function _writeConceptCache(query: string, lang: string, results: ConceptResult[]): void {
  try {
    const entry: ConceptCacheEntry = { ts: Date.now(), results };
    localStorage.setItem(_conceptCacheKey(query, lang), JSON.stringify(entry));
  } catch { /* ignore */ }
}

const SEMANTIC_SYSTEM =
  "You are CODEX SEMANTIC SEARCH. The user is asking for Bible passages " +
  "relevant to their concept query. Return ONLY a JSON array (no prose) of " +
  "relevant passages, ranked by relevance. 15 results max. For each: ref " +
  "(book chapter:verse like \"John 3:16\"), passage_text (the verse text in " +
  "KJV unless user implies another translation), relevance (one short " +
  "sentence on why this passage is relevant), score (0.0-1.0). Cast a wide " +
  "net — include both obvious and surprising matches. Span Old + New " +
  "Testament + apocrypha where relevant.";

function _parseSemanticJSON(text: string): RawSemanticItem[] {
  if (!text) return [];
  // Strip ```json fences if any
  let t = String(text).trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = (fence[1] ?? "").trim();
  // Try to find the array bounds if there's prose
  const first = t.indexOf("[");
  const last  = t.lastIndexOf("]");
  if (first >= 0 && last > first) t = t.slice(first, last + 1);
  try {
    const arr = JSON.parse(t) as unknown;
    if (!Array.isArray(arr)) return [];
    return (arr as unknown[])
      .filter((x): x is { ref: string; passage_text?: unknown; relevance?: unknown; score?: unknown } =>
        x !== null &&
        typeof x === "object" &&
        typeof (x as { ref?: unknown }).ref === "string"
      )
      .map(x => ({
        ref:          x.ref,
        passage_text: typeof x.passage_text === "string" ? x.passage_text : "",
        relevance:    typeof x.relevance === "string" ? x.relevance : "",
        score:        typeof x.score === "number"
          ? Math.max(0, Math.min(1, x.score))
          : 0.5,
      }));
  } catch { return []; }
}

// Parse "John 3:16" / "1 John 3:16" / "Song of Solomon 2:1" → {bookId, chapter, verse}
function _parseHumanRef(ref: string): ParsedHumanRef | null {
  if (!ref || typeof ref !== "string") return null;
  const m = ref.trim().match(/^(.+?)\s+(\d+):(\d+)/);
  if (!m) return null;
  const name    = (m[1] ?? "").trim().toLowerCase();
  const chapter = Number(m[2]);
  const verse   = Number(m[3]);
  let bookId: string | null = null;
  try {
    const books = sw().CODEX_DATA?.books ?? [];
    const norm   = (s: string): string => String(s || "").toLowerCase().replace(/\s+/g, "");
    const target = norm(name);
    let best = books.find(b => norm(b.name) === target || norm(b.id) === target);
    if (!best) best = books.find(b =>
      norm(b.name).startsWith(target) || target.startsWith(norm(b.name)));
    if (!best) {
      // aliases like "Ps" → Psalms, "Mt" → Matthew, "1Jn" → 1 John
      best = books.find(b => {
        const aliases = b.aliases ?? [];
        return aliases.some(a => norm(a) === target);
      });
    }
    if (best) bookId = best.id;
  } catch { /* ignore */ }
  return { bookId, bookName: (m[1] ?? "").trim(), chapter, verse };
}

export async function searchSemantic(query: string, opts: SemanticSearchOpts = {}): Promise<SemanticSearchResult> {
  const q = String(query || "").trim();
  if (!q) return { results: [], fromCache: false };
  const lang = opts.lang ?? _lang();

  // Cache first
  const cached = _readConceptCache(q, lang);
  if (cached !== null && !opts.force) {
    return { results: cached.results, fromCache: true, ts: cached.ts };
  }

  const tweaks  = _tweaks();
  const provider = opts.provider ?? tweaks.provider ?? "anthropic";
  const model    = opts.model    ?? tweaks.model    ?? null;

  let resp: Response;
  try {
    resp = await fetch("/api/chat", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({
        provider, model,
        system:    SEMANTIC_SYSTEM,
        messages:  [{ role: "user", content: q }],
        max_tokens: 2000,
      }),
    });
  } catch {
    // NOTE: preserved from legacy — throw a plain Error with a `kind` discriminant.
    throw Object.assign(new Error("network"), { kind: "network" as const });
  }

  let data: { text?: unknown; error?: unknown } | null = null;
  try { data = await resp.json() as { text?: unknown; error?: unknown }; } catch { /* ignore */ }

  if (!resp.ok) {
    const msg  = data?.error != null ? String(data.error) : `HTTP ${resp.status}`;
    const kind = /key|auth|401|403/i.test(msg) ? "auth" : "api";
    throw Object.assign(new Error(msg), { kind });
  }

  const rawText = data?.text != null ? String(data.text) : "";
  const items   = _parseSemanticJSON(rawText);
  const enriched: ConceptResult[] = items.map(it => {
    const parsed = _parseHumanRef(it.ref);
    return {
      ref:       it.ref,
      bookId:    parsed?.bookId    ?? null,
      chapter:   parsed?.chapter   ?? null,
      verse:     parsed?.verse     ?? null,
      text:      it.passage_text   ?? "",
      relevance: it.relevance      ?? "",
      score:     it.score          ?? 0.5,
    };
  });
  _writeConceptCache(q, lang, enriched);
  return { results: enriched, fromCache: false, ts: Date.now() };
}
