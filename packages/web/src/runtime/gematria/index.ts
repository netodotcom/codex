// Gematria — entry point. Replaces legacy/gematria.js.
// Computes and assigns window.CODEX_GEMATRIA and window.CODEX_GEMATRIA_INDEX
// at import time, preserving the exact load-time order and timing of the
// legacy IIFE: CODEX_GEMATRIA set first, index bootstrap second, event
// listener registered third, CODEX_GEMATRIA_INDEX set last.
import {
  detectLang, strip,
  mispar_hechrachi, mispar_gadol, mispar_sidduri,
  mispar_katan, mispar_katan_mispari, mispar_boneh, mispar_kidmi,
  atbash, albam, mispar_neelam, mispar_haakhor,
  isopsephy_standard, isopsephy_ordinal, isopsephy_reduced,
  english_ordinal, english_reduction, english_reverse,
  all,
} from "./helpers.js";
import type { IndexMatch, IndexRecord, IndexStats } from "./types.js";
import { gw } from "./gematria-window.js";

// ── CODEX_GEMATRIA ─────────────────────────────────────────────────────────────
gw().CODEX_GEMATRIA = {
  detectLang, strip,
  hebrew: {
    hechrachi: mispar_hechrachi, gadol: mispar_gadol, sidduri: mispar_sidduri,
    katan: mispar_katan, katan_mispari: mispar_katan_mispari,
    boneh: mispar_boneh, kidmi: mispar_kidmi,
    atbash, albam, neelam: mispar_neelam, haakhor: mispar_haakhor,
  },
  greek:   { isopsephy: isopsephy_standard, ordinal: isopsephy_ordinal, reduced: isopsephy_reduced },
  english: { ordinal: english_ordinal, reduction: english_reduction, reverse: english_reverse },
  all,
};

// ════════════════════════════════════════════════════════════════════════════════
// CROSS-REFERENCE INDEX over the user's cached verses
// ════════════════════════════════════════════════════════════════════════════════
// Strategy: scan localStorage["codex.bible.cache.v2"] (fallback) AND
// BIBLE._memCache (preferred — reaches IDB-loaded verses). For each
// verse, compute a "word-level" value list and group by primary system
// (hechrachi for Hebrew, isopsephy for Greek, ordinal for English).
// Persist {value: [{ref, word, system}]} to localStorage so subsequent
// panel opens are instant. Re-index when bible:bundle-loaded fires.

const INDEX_KEY = "codex.gematria.index.v1";
const MAX_PER_VALUE = 50;
let _index: IndexRecord | null = null;
let _building = false;
let _builtAt = 0;

// ── Persistence ───────────────────────────────────────────────────────────────
interface StoredIndex {
  _v: number;
  builtAt: number;
  index: IndexRecord;
}

function loadIndexFromStorage(): IndexRecord | null {
  try {
    const raw = localStorage.getItem(INDEX_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredIndex | null;
    if (parsed && parsed._v === 1) {
      _builtAt = parsed.builtAt || 0;
      return parsed.index ?? {};
    }
  } catch { /* ignore */ }
  return null;
}

function saveIndex(): void {
  // NOTE: preserved from legacy — over-quota is silently dropped.
  try {
    const payload: StoredIndex = { _v: 1, builtAt: Date.now(), index: _index! };
    localStorage.setItem(INDEX_KEY, JSON.stringify(payload));
    _builtAt = payload.builtAt;
  } catch { /* over-quota — silently drop */ }
}

// ── Tokenizer ─────────────────────────────────────────────────────────────────
// tokens: words split on whitespace / punctuation. Keeps Hebrew + Greek
// intact (those scripts have their own punctuation).
function tokenize(verseText: string): string[] {
  return (verseText || "")
    .replace(/[֑-ֽֿׁ-ׇ׳״]/g, "")  // hebrew niqqud/cantillation/punct
    .split(/[\s.,;:!?·"׳״״«»()\[\]{}‐\-—]+/)
    .filter((w) => w && w.length >= 2);
}

// ── Index operations ──────────────────────────────────────────────────────────
function pushMatch(value: number, system: string, ref: string, word: string): void {
  if (!value || value < 2) return; // skip 0/1 noise
  if (!_index) return;
  let bucket = _index[value];
  if (bucket === undefined) {
    bucket = [];
    _index[value] = bucket;
  }
  if (bucket.length >= MAX_PER_VALUE) return;
  // dedupe: same ref+word+system
  for (const m of bucket) if (m.ref === ref && m.word === word && m.system === system) return;
  bucket.push({ ref, word, system });
}

function refForVerse(bookId: string, chapter: string, verseNum: number): string {
  return `${bookId}.${chapter}.${verseNum}`;
}

// Yield to the event loop every N verses so the UI doesn't freeze.
function yieldTick(): Promise<void> { return new Promise<void>((r) => setTimeout(r, 0)); }

// Read the chapters store directly from bible.js's IndexedDB. Mirrors
// the schema in bible.js: DB "codex", object store "chapters", value
// shape { verses: string[], fetchedAt, source, translation }.
function readChaptersFromIDB(): Promise<Record<string, unknown>> {
  return new Promise<Record<string, unknown>>((resolve) => {
    if (!gw().indexedDB) { resolve({}); return; }
    let req: IDBOpenDBRequest;
    try { req = indexedDB.open("codex"); }
    catch { resolve({}); return; }
    req.onerror = () => resolve({});
    req.onsuccess = () => {
      const db: IDBDatabase = req.result;
      if (!db.objectStoreNames.contains("chapters")) { db.close(); resolve({}); return; }
      const out: Record<string, unknown> = {};
      try {
        const tx = db.transaction("chapters", "readonly");
        const curReq: IDBRequest<IDBCursorWithValue | null> =
          tx.objectStore("chapters").openCursor();
        curReq.onsuccess = (e: Event) => {
          const cursor = (e.target as IDBRequest<IDBCursorWithValue | null>).result;
          if (cursor) {
            const v = cursor.value as { verses?: unknown } | undefined;
            if (v && Array.isArray(v.verses)) out[cursor.key as string] = v.verses;
            cursor.continue();
          } else { db.close(); resolve(out); }
        };
        curReq.onerror = () => { db.close(); resolve(out); };
      } catch { db.close(); resolve({}); }
    };
  });
}

async function build(opts: Record<string, unknown> = {}): Promise<IndexRecord | null> {
  void opts; // accepted for API parity with legacy; not used
  if (_building) return _index;
  _building = true;
  if (!_index) _index = {};

  // Snapshot the BIBLE mem cache. Keys are `bookId.chapter.translation`,
  // values are arrays of verse strings (1-indexed by position).
  let cache: Record<string, unknown> = {};
  try {
    const bible = gw().BIBLE;
    if (bible?.ready) await bible.ready;
  } catch { /* ignore */ }
  // Primary: read directly from the same IndexedDB store bible.js uses
  // ("codex" / "chapters"). Each record's value is { verses, ... }.
  try { cache = await readChaptersFromIDB(); } catch { /* ignore */ }
  // Fallbacks: anything bible.js exposed in memory, then legacy localStorage blob.
  if (!cache || !Object.keys(cache).length) {
    try { cache = gw().BIBLE?._memCache ?? {}; } catch { /* ignore */ }
  }
  if (!cache || !Object.keys(cache).length) {
    try {
      const raw = localStorage.getItem("codex.bible.cache.v2");
      if (raw) cache = JSON.parse(raw) as Record<string, unknown>;
    } catch { cache = {}; }
  }
  cache = cache || {};

  let processed = 0;
  for (const key of Object.keys(cache)) {
    const parts = key.split(".");
    if (parts.length < 3) continue;
    const bookId = parts[0] ?? "";
    const chapter = parts[1] ?? "";
    const verses = cache[key];
    if (!Array.isArray(verses)) continue;
    for (let i = 0; i < verses.length; i++) {
      // Verses may be plain strings or {text: string} objects (IDB vs legacy cache shapes).
      // NOTE: preserved from legacy — both shapes are handled identically.
      const entry: unknown = verses[i];
      const text: string =
        typeof entry === "string"
          ? entry
          : (typeof entry === "object" && entry !== null && "text" in entry)
            ? String((entry as { text?: unknown }).text ?? "")
            : "";
      const ref = refForVerse(bookId, chapter, i + 1);
      const tokens = tokenize(text);
      for (const tok of tokens) {
        const lang = detectLang(tok);
        if (lang === "hebrew") {
          const v = mispar_hechrachi(tok);
          if (v) pushMatch(v, "hechrachi", ref, tok);
        } else if (lang === "greek") {
          const v = isopsephy_standard(tok);
          if (v) pushMatch(v, "isopsephy", ref, tok);
        } else {
          // English: only index reasonably substantive words (avoid 'the', 'a' noise)
          if (tok.length < 4) continue;
          const v = english_ordinal(tok);
          if (v) pushMatch(v, "en_ordinal", ref, tok);
        }
      }
      processed++;
      if (processed % 1000 === 0) await yieldTick();
    }
  }
  saveIndex();
  _building = false;
  try {
    window.dispatchEvent(new CustomEvent("codex:gematria:indexed", {
      detail: { values: Object.keys(_index).length, builtAt: _builtAt },
    }));
  } catch { /* ignore */ }
  return _index;
}

function find(value: number, opts: { system?: string } = {}): IndexMatch[] {
  if (!_index) return [];
  const arr: IndexMatch[] = _index[value] ?? [];
  const sys = opts.system;
  return sys ? arr.filter((m) => m.system === sys) : arr.slice();
}

function stats(): IndexStats {
  if (!_index) return { values: 0, matches: 0, builtAt: 0 };
  let total = 0;
  for (const k of Object.keys(_index)) {
    const bucket = _index[k];
    if (bucket !== undefined) total += bucket.length;
  }
  return { values: Object.keys(_index).length, matches: total, builtAt: _builtAt };
}

function reset(): void {
  _index = {};
  try { localStorage.removeItem(INDEX_KEY); } catch { /* ignore */ }
  _builtAt = 0;
}

// Bootstrap: load persisted index if present so first open is instant.
// NOTE: preserved from legacy — `|| null` is intentional: an empty stored
// index ({}) is truthy so it stays; undefined/null falls back to null.
_index = loadIndexFromStorage() || null;

// Re-index opportunistically when new bible content lands.
try {
  window.addEventListener("codex:bible:bundle-loaded", () => {
    // throttled rebuild — at most once per minute
    if (Date.now() - _builtAt > 60_000) build().catch(() => { /* ignore */ });
  });
} catch { /* ignore */ }

// ── CODEX_GEMATRIA_INDEX ───────────────────────────────────────────────────────
gw().CODEX_GEMATRIA_INDEX = {
  build,
  find,
  stats,
  reset,
  ensure: async () => { if (!_index || stats().values === 0) await build(); return _index; },
};
