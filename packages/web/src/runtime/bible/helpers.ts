// bible — loader logic (faithful port from legacy/bible.js).
// Scripture chapter loader with IndexedDB caching, multi-translation support,
// bundle loading, red-letter annotation, download/repair tooling.
// Pure browser JS, no deps beyond DOM globals.
import type {
  VerseEntry,
  MultiVerseRow,
  MemCache,
  CachedChapterRecord,
  BatchEntry,
  BibleTranslationEntry,
  SourceEntry,
  DownloadProgressCallback,
  DownloadController,
  CacheStats,
  MissingChapter,
  VerifyResult,
  BibleBook,
  TranslationUpdateInfo,
  BundlePayload,
  ExportedBundle,
  StorageDiagnostics,
} from "./types.js";
import { bw } from "./bible-window.js";

const API   = "https://bible-api.com";
const BOLLS = "https://bolls.life";
const CACHE_KEY = "codex.bible.cache.v2";

// bookId → bolls.life numeric book id (1=Genesis … 66=Revelation).
export const BOOK_BOLLS: Record<string, number> = {
  gen:1, exo:2, lev:3, num:4, deu:5, jos:6, jdg:7, rut:8,
  "1sa":9, "2sa":10, "1ki":11, "2ki":12, "1ch":13, "2ch":14,
  ezr:15, neh:16, est:17, job:18, psa:19, pro:20, ecc:21, sng:22,
  isa:23, jer:24, lam:25, ezk:26, dan:27, hos:28, jol:29, amo:30,
  oba:31, jon:32, mic:33, nam:34, hab:35, zep:36, hag:37, zec:38, mal:39,
  mat:40, mrk:41, luk:42, jhn:43, act:44, rom:45,
  "1co":46, "2co":47, gal:48, eph:49, php:50, col:51,
  "1th":52, "2th":53, "1ti":54, "2ti":55, tit:56, phm:57, heb:58, jas:59,
  "1pe":60, "2pe":61, "1jn":62, "2jn":63, "3jn":64, jud:65, rev:66,
};

// Local book id → bible-api book slug.
export const BOOK_API: Record<string, string> = {
  gen: "genesis", exo: "exodus", lev: "leviticus", num: "numbers", deu: "deuteronomy",
  jos: "joshua", jdg: "judges", rut: "ruth", "1sa": "1 samuel", "2sa": "2 samuel",
  "1ki": "1 kings", "2ki": "2 kings", "1ch": "1 chronicles", "2ch": "2 chronicles",
  ezr: "ezra", neh: "nehemiah", est: "esther", job: "job", psa: "psalms",
  pro: "proverbs", ecc: "ecclesiastes", sng: "song of solomon", isa: "isaiah",
  jer: "jeremiah", lam: "lamentations", ezk: "ezekiel", dan: "daniel",
  hos: "hosea", jol: "joel", amo: "amos", oba: "obadiah", jon: "jonah",
  mic: "micah", nam: "nahum", hab: "habakkuk", zep: "zephaniah", hag: "haggai",
  zec: "zechariah", mal: "malachi",
  mat: "matthew", mrk: "mark", luk: "luke", jhn: "john", act: "acts",
  rom: "romans", "1co": "1 corinthians", "2co": "2 corinthians", gal: "galatians",
  eph: "ephesians", php: "philippians", col: "colossians",
  "1th": "1 thessalonians", "2th": "2 thessalonians",
  "1ti": "1 timothy", "2ti": "2 timothy", tit: "titus", phm: "philemon",
  heb: "hebrews", jas: "james", "1pe": "1 peter", "2pe": "2 peter",
  "1jn": "1 john", "2jn": "2 john", "3jn": "3 john", jud: "jude", rev: "revelation",
};

// ── Resolve translation ───────────────────────────────────────────────────────
function resolveTranslation(t: string): { source: string; apiId: string } {
  const reg = (bw().CODEX_DATA?.translations ?? []).find(x => x.id === t);
  if (reg) return { source: reg.source ?? "bible-api", apiId: reg.apiId ?? t };
  return { source: "bible-api", apiId: t };
}

// ── STORAGE · Phase A · IndexedDB-backed durable store + sync mem mirror ─────
// Schema:
//   DB "codex" v1
//     store "chapters"  key "bookId.chapter.translation" → {verses, fetchedAt, source, pinned, translation}
//                       index "translation"
//     store "meta"      key string → any
//
// First run: copy any legacy localStorage["codex.bible.cache.v2"] into
// IDB transparently, mark migrated, drop the LS key. User loses nothing.
const DB_NAME        = "codex";
const DB_VERSION     = 1;
const STORE_CHAPTERS = "chapters";
const STORE_META     = "meta";
const MIGRATED_FLAG  = "migrated.from.ls.v2";

let _db: IDBDatabase | null = null;
let _memCache: MemCache = {};
const _dirty = new Set<string>();
let _flushTimer: ReturnType<typeof setTimeout> | null = null;

function _openDB(): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (!window.indexedDB) return reject(new Error("IndexedDB unavailable"));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e: IDBVersionChangeEvent) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_CHAPTERS)) {
        const s = db.createObjectStore(STORE_CHAPTERS);
        s.createIndex("translation", "translation", { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META);
      }
    };
    req.onsuccess = () => { resolve(req.result); };
    req.onerror   = () => { reject(req.error); };
  });
}

function _idbReq<T>(
  store: string,
  mode: IDBTransactionMode,
  op: (s: IDBObjectStore) => IDBRequest<T> | void,
): Promise<T | undefined> {
  return new Promise<T | undefined>((resolve, reject) => {
    if (!_db) return reject(new Error("DB not open"));
    const tx = _db.transaction(store, mode);
    const s = tx.objectStore(store);
    const r = op(s);
    // NOTE: preserved from legacy — dual-path: if op returns a request, wire
    // onsuccess/onerror on it; otherwise fall through to tx.oncomplete.
    if (r && r.onsuccess !== undefined) {
      r.onsuccess = () => { resolve(r.result); };
      r.onerror   = () => { reject(r.error); };
    } else {
      tx.oncomplete = () => { resolve(undefined); };
      tx.onerror    = () => { reject(tx.error); };
    }
  });
}

function _metaGet(k: string): Promise<unknown> {
  return _idbReq(STORE_META, "readonly",  s => s.get(k) as IDBRequest<unknown>);
}
function _metaSet(k: string, v: unknown): Promise<unknown> {
  return _idbReq(STORE_META, "readwrite", s => s.put(v, k) as IDBRequest<IDBValidKey>);
}

function _putBatch(entries: BatchEntry[]): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (!_db) return reject(new Error("DB not open"));
    const tx = _db.transaction(STORE_CHAPTERS, "readwrite");
    const store = tx.objectStore(STORE_CHAPTERS);
    for (const { key, value } of entries) store.put(value, key);
    tx.oncomplete = () => { resolve(); };
    tx.onerror    = () => { reject(tx.error); };
  });
}

async function _loadAllToMem(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (!_db) return reject(new Error("DB not open"));
    const tx = _db.transaction(STORE_CHAPTERS, "readonly");
    const req = tx.objectStore(STORE_CHAPTERS).openCursor();
    req.onsuccess = (e: Event) => {
      const c = (e.target as IDBRequest<IDBCursorWithValue | null>).result;
      if (c) {
        // Stored shape: { verses, fetchedAt, source, pinned, translation }.
        // Mem mirror exposes just the verses array (legacy contract).
        _memCache[c.key as string] = (c.value as CachedChapterRecord).verses;
        c.continue();
      } else {
        resolve();
      }
    };
    req.onerror = () => { reject(req.error); };
  });
}

async function _migrateFromLocalStorage(): Promise<number> {
  let legacy: Record<string, VerseEntry[]>;
  try { legacy = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}") as Record<string, VerseEntry[]>; }
  catch { legacy = {}; }
  const entries = Object.entries(legacy);
  if (entries.length === 0) return 0;
  const now = Date.now();
  const batch: BatchEntry[] = entries.map(([key, verses]) => {
    const parts = key.split(".");
    const translation = parts[parts.length - 1] ?? key;
    return {
      key,
      value: { verses, fetchedAt: now, source: "legacy-localStorage", pinned: true, translation },
    };
  });
  await _putBatch(batch);
  for (const [key, verses] of entries) _memCache[key] = verses;
  try { localStorage.removeItem(CACHE_KEY); } catch { /* free the 5MB */ }
  return entries.length;
}

// Public init promise — anything async-aware should `await BIBLE.ready`.
// loadChapter / loadMulti always await this internally so existing
// sync-flavored call sites need no change.
export const _ready: Promise<void> = (async () => {
  try {
    _db = await _openDB();
    await _loadAllToMem();
    const migrated = await _metaGet(MIGRATED_FLAG);
    if (!migrated) {
      const n = await _migrateFromLocalStorage();
      await _metaSet(MIGRATED_FLAG, { at: Date.now(), count: n });
    }
  } catch (e: unknown) {
    // IDB unavailable (private mode in some browsers, etc.) — fall back
    // to legacy localStorage so the app still works, just smaller.
    console.warn("BIBLE: IDB unavailable, using localStorage fallback:", e);
    try { _memCache = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}") as MemCache; }
    catch { _memCache = {}; }
  }
  // Notify listeners (Settings panel re-derives from cache after init).
  try { window.dispatchEvent(new CustomEvent("codex:bible:ready")); } catch { /* swallow */ }
})();

function _scheduleFlush(): void {
  if (_flushTimer) return;
  _flushTimer = setTimeout(() => { _flushTimer = null; _flushDirty().catch(() => {}); }, 200);
}

async function _flushDirty(): Promise<void> {
  if (_dirty.size === 0) return;
  const keys = [..._dirty];
  _dirty.clear();
  if (!_db) {
    // Fallback path — write the full mem blob to localStorage with the
    // 4.5MB safety. Kept for browsers that block IDB (rare).
    try {
      const s = JSON.stringify(_memCache);
      if (s.length > 4_500_000) {
        const ks = Object.keys(_memCache);
        ks.slice(0, Math.floor(ks.length / 2)).forEach(k => { delete _memCache[k]; });
        localStorage.setItem(CACHE_KEY, JSON.stringify(_memCache));
      } else {
        localStorage.setItem(CACHE_KEY, s);
      }
    } catch { /* swallow */ }
    return;
  }
  const now = Date.now();
  const batch: BatchEntry[] = keys.map(key => {
    const parts = key.split(".");
    const translation = parts[parts.length - 1] ?? key;
    return { key, value: { verses: _memCache[key] ?? [], fetchedAt: now, source: "fetch", pinned: true, translation } };
  });
  try { await _putBatch(batch); } catch (e: unknown) { console.warn("IDB flush failed:", e); }
}

// Legacy shims so older code paths keep working.
export function ensureCache(): MemCache { return _memCache; }
export function readCache(): MemCache   { return _memCache; }
export function writeCache(c: MemCache): void {
  // legacy "replace whole cache" callers — diff against existing and mark dirty.
  for (const k of Object.keys(c)) {
    if (_memCache[k] !== c[k]) { _memCache[k] = c[k] ?? []; _dirty.add(k); }
  }
  for (const k of Object.keys(_memCache)) {
    if (!(k in c)) {
      delete _memCache[k];
      if (_db) _idbReq(STORE_CHAPTERS, "readwrite", s => { s.delete(k); }).catch(() => {});
    }
  }
  _scheduleFlush();
}

// ── PHASE B · Source-resolution chain + bundle hook for Phase C ───────────────
// Each translation has an implicit source priority chain:
//   1. Pre-baked bundle (if t.bundle defined and not yet loaded)
//   2. Primary source: `source` + `apiId`
//   3. Mirrors: t.mirrors = [{kind, apiId}, ...] (optional)
// If the primary fails (rate limit, outage, network), we fall through
// to mirrors before reporting failure.
function _sourceChain(t: BibleTranslationEntry | undefined): SourceEntry[] {
  if (!t) return [];
  const chain: SourceEntry[] = [];
  if (t.source && t.apiId) chain.push({ kind: t.source, apiId: t.apiId, projectId: t.projectId });
  if (Array.isArray(t.mirrors)) for (const m of t.mirrors) chain.push(m);
  return chain;
}

// ── Bundle loader · Phase C foundation ───────────────────────────────────────
// First read of a bundle-equipped translation triggers a single fetch
// of the static JSON file shipped with the app. Once parsed, every
// chapter writes into IDB and the mem mirror in one transaction.
// Bundle file format:
//   { translation: "kjv", version: 1, chapters: { "jhn.1": [verses], ... } }
const _bundleStatus = new Map<string, "loading" | "loaded" | "failed" | "skip">();

export async function _loadBundleOnce(t: BibleTranslationEntry & { bundle: string }): Promise<boolean> {
  const status = _bundleStatus.get(t.id);
  if (status === "loaded" || status === "skip" || status === "failed") return status === "loaded";
  if (status === "loading") {
    // Wait for the in-flight load to finish
    while (_bundleStatus.get(t.id) === "loading") {
      await new Promise<void>(r => setTimeout(r, 50));
    }
    return _bundleStatus.get(t.id) === "loaded";
  }
  _bundleStatus.set(t.id, "loading");
  try {
    const r = await fetch(t.bundle, { cache: "force-cache" });
    if (!r.ok) {
      _bundleStatus.set(t.id, r.status === 404 ? "skip" : "failed");
      return false;
    }
    const data = await r.json() as { chapters?: unknown };
    if (!data?.chapters || typeof data.chapters !== "object") {
      _bundleStatus.set(t.id, "failed");
      return false;
    }
    // Bulk-write everything into IDB + mem in one transaction.
    const now = Date.now();
    const batch: BatchEntry[] = [];
    for (const [bookCh, verses] of Object.entries(data.chapters as Record<string, unknown>)) {
      const key = `${bookCh}.${t.id}`;
      if (!Array.isArray(verses) || verses.length === 0) continue;
      _memCache[key] = verses as VerseEntry[];
      batch.push({ key, value: { verses: verses as VerseEntry[], fetchedAt: now, source: "bundle", pinned: true, translation: t.id } });
    }
    if (_db && batch.length) await _putBatch(batch);
    _bundleStatus.set(t.id, "loaded");
    try { window.dispatchEvent(new CustomEvent("codex:bible:bundle-loaded", { detail: { translation: t.id, count: batch.length } })); } catch { /* swallow */ }
    return true;
  } catch (e: unknown) {
    _bundleStatus.set(t.id, "failed");
    console.warn(`bundle load failed for ${t.id}:`, e);
    return false;
  }
}

// Try ONE source. Returns parsed verses on success, throws on failure.
export async function _fetchFromSource(
  src: SourceEntry,
  bookId: string,
  chapter: number,
  translation: string,
): Promise<VerseEntry[]> {
  if (src.kind === "bolls") {
    const bookNum = BOOK_BOLLS[bookId];
    if (!bookNum) throw new Error("Unknown book: " + bookId);
    const url = `${BOLLS}/get-text/${src.apiId}/${bookNum}/${chapter}/`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`bolls ${translation} ${bookId} ${chapter}: ${r.status}`);
    const data = await r.json() as unknown;
    return (Array.isArray(data) ? data as Array<{ verse: number; text: unknown }> : []).map(v => ({
      n: v.verse,
      text: String(v.text ?? "")
        .replace(/<[^>]+>/g, "")
        // bolls.life leaks Strong's numbers — sometimes glued to the
        // preceding word ("man444"), sometimes standalone ("man 444 that").
        // Strip both forms. Two-or-more digit standalones are always
        // markup leakage; scripture text never carries inline integers.
        // NOTE: preserved from legacy — lookbehind regex; exact pattern kept
        .replace(/(?<=[a-zA-ZéÀ-ſ'])\d+/g, "")
        .replace(/(?<=^|[\s.,;:!?()'"—–-])\d{2,5}(?=[\s.,;:!?()'"—–-]|$)/g, "")
        .replace(/\s+/g, " ").trim(),
    }));
  }
  if (src.kind === "bible-api") {
    const slug = BOOK_API[bookId];
    if (!slug) throw new Error("Unknown book: " + bookId);
    const isLatin = src.apiId === "clementine";
    const lookup = isLatin ? bookId.toUpperCase() : slug;
    const url = `${API}/${encodeURIComponent(lookup)}+${chapter}?translation=${src.apiId}`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`bible-api ${translation} ${lookup} ${chapter}: ${r.status}`);
    const data = await r.json() as { verses?: Array<{ verse: number; text: unknown }> };
    return (data.verses ?? []).map(v => ({
      n: v.verse,
      text: String(v.text ?? "").replace(/\s+/g, " ").trim(),
    }));
  }
  if (src.kind === "bundle") {
    // Static-bundle source — fetch a JSON file shipped with the app
    // (or hosted at any same-origin URL). Used for translations whose
    // canon includes books no public CORS API serves (Enoch, Jubilees,
    // Meqabyan, etc.). Layout: { [bookId]: { [chapter]: [{n,text}] } }
    // Per-chapter fallback. _loadBundleOnce already bulk-loads the whole
    // file on first access for translations with `bundle:`, so this path
    // only runs for ad-hoc bundle-only translations without that field.
    const t = (bw().CODEX_DATA?.translations ?? []).find(x => x.id === translation);
    const url = src.bundleUrl ?? (typeof t?.bundle === "string" ? t.bundle : `data/bibles/${src.apiId}.json`);
    const placeholderVerse = (): VerseEntry[] => ([{
      n: 1,
      text: `[${t?.name ?? translation}] · Text not yet bundled. The registry knows this translation, but the public-domain payload has not been integrated into the app yet. Switch translations from the right rail to read this chapter.`,
    }]);
    try {
      const r = await fetch(url, { cache: "force-cache" });
      if (!r.ok) {
        if (t?.placeholder) return placeholderVerse();
        throw new Error(`bundle ${translation} ${bookId} ${chapter}: ${r.status}`);
      }
      const data = await r.json() as { chapters?: Record<string, VerseEntry[]>; [k: string]: unknown };
      const flatKey = `${bookId}.${chapter}`;
      const ch = (data.chapters && data.chapters[flatKey])
              ?? ((data[bookId] as Record<number, VerseEntry[]> | undefined)?.[chapter]);
      if (!Array.isArray(ch)) {
        if (t?.placeholder) return placeholderVerse();
        // Partial bundle — chapter not included yet. Show a gentle fallback
        // instead of erroring so users can still browse available chapters.
        return [{ n: 1, text: `[${t?.name ?? translation}] · This chapter is not yet included in the offline bundle. Try a different chapter or switch translations.` }];
      }
      return (ch as Array<{ n?: number; verse?: number; text: unknown }>).map(v => ({ n: v.n ?? v.verse ?? 0, text: String(v.text ?? "").replace(/\s+/g, " ").trim() }));
    } catch (e: unknown) {
      if (t?.placeholder) return placeholderVerse();
      throw e;
    }
  }
  throw new Error("Unknown source kind: " + src.kind);
}

// Re-sanitise verses on every read. Older cache entries (from before
// the Strong's-number leak was patched) may still contain stray "444"
// / "G2316" tokens from bolls.life — this scrub applies idempotently
// so users see clean text the moment they upgrade, without us having
// to nuke their offline verse cache.
// NOTE: preserved from legacy — exact regex pattern kept
export function _scrubVerses(verses: VerseEntry[]): VerseEntry[] {
  if (!Array.isArray(verses)) return verses;
  let mutated = false;
  const out = verses.map(v => {
    const orig = String(v.text ?? "");
    const clean = orig
      .replace(/(?<=[a-zA-ZéÀ-ſ'])\d+/g, "")
      .replace(/(?<=^|[\s.,;:!?()'"—–-])\d{2,5}(?=[\s.,;:!?()'"—–-]|$)/g, "")
      .replace(/\s+/g, " ").trim();
    if (clean !== orig) mutated = true;
    return mutated ? { ...v, text: clean } : v;
  });
  return mutated ? out : verses;
}

// Synchronous cached-read mirror of loadChapter's cached branch.
// Returns the scrubbed verses if the chapter is already in _memCache,
// else null. Applies the SAME _scrubVerses transform and persists it back
// exactly as loadChapter does. No red-letter (loadChapter does not apply
// it; red-letter is a caller-side layer).
export function getCachedChapter(bookId: string, chapter: number, translation: string): VerseEntry[] | null {
  const key = `${bookId}.${chapter}.${translation}`;
  if (!_memCache[key]) return null;
  const scrubbed = _scrubVerses(_memCache[key]!);
  if (scrubbed !== _memCache[key]) {
    _memCache[key] = scrubbed;
    _dirty.add(key); _scheduleFlush();
  }
  return _memCache[key] ?? null;
}

// In-flight dedupe — v10: the plugin reader and the app's panel pipeline
// both load the current chapter; without this they'd issue two identical
// network fetches (and feed the free APIs' rate limiters).
const _inflight = new Map<string, Promise<VerseEntry[]>>();

export async function loadChapter(bookId: string, chapter: number, translation: string): Promise<VerseEntry[]> {
  if (_ready) await _ready;
  const key = `${bookId}.${chapter}.${translation}`;
  if (_memCache[key]) {
    const scrubbed = _scrubVerses(_memCache[key]!);
    if (scrubbed !== _memCache[key]) {
      _memCache[key] = scrubbed;
      _dirty.add(key); _scheduleFlush();
    }
    return _memCache[key]!;
  }
  const inflight = _inflight.get(key);
  if (inflight) return inflight;
  const p = _loadChapterFresh(bookId, chapter, translation, key)
    .finally(() => { _inflight.delete(key); });
  _inflight.set(key, p);
  return p;
}

async function _loadChapterFresh(bookId: string, chapter: number, translation: string, key: string): Promise<VerseEntry[]> {
  // Phase B/C: try the pre-baked bundle first ONLY when explicitly
  // declared on the translation (`t.bundle` is a string path, or
  // `t.bundle === true` to use the convention path). No bundle field =
  // no probe, so the streaming case (open any translation with internet
  // and read instantly) takes zero extra round-trips.
  const t = (bw().CODEX_DATA?.translations ?? []).find(x => x.id === translation);
  if (t?.bundle && _bundleStatus.get(translation) !== "skip" && _bundleStatus.get(translation) !== "failed") {
    const bundlePath = typeof t.bundle === "string" ? t.bundle : `/data/bibles/${translation}.json`;
    await _loadBundleOnce({ ...t, bundle: bundlePath });
    if (_memCache[key]) return _memCache[key]!;
  }

  // Try each network source in priority order.
  const chain = _sourceChain(t);
  let lastErr: unknown = null;
  for (const src of chain) {
    try {
      const verses = await _fetchFromSource(src, bookId, chapter, translation);
      _memCache[key] = verses;
      _dirty.add(key);
      _scheduleFlush();
      return verses;
    } catch (e: unknown) {
      lastErr = e;
      // try next source
    }
  }
  if (chain.length === 0) throw new Error(`No source for translation: ${translation}`);
  throw lastErr ?? new Error(`All sources failed for ${translation} ${bookId} ${chapter}`);
}

// ── Red-letter system ─────────────────────────────────────────────────────────
// One source of truth: data/red-letter.json — GENERATED from the World
// English Bible's <wj> (words-of-Jesus) markup.
// For every verse in the truth set we mark the WHOLE verse red across
// every loaded translation. No heuristics, no per-string painting.
// The covered-book set is DERIVED from the dataset (any "<book>." key).
const RED_LETTER_BOOKS = new Set(["mat", "mrk", "luk", "jhn", "act", "rev"]);

// ── Authoritative red-letter ground truth ─────────────────────────────────────
// Static JSON dataset (data/red-letter.json) of verses where Jesus
// speaks — loaded once on startup.
const RED_LETTER_TRUTH: Record<string, Set<number>> = {};
let _truthLoaded = false;
let _truthLoadPromise: Promise<void> | null = null;

export function parseRange(spec: string): Set<number> {
  const out = new Set<number>();
  if (!spec || typeof spec !== "string") return out;
  for (const part of spec.split(",")) {
    const seg = part.trim();
    if (!seg) continue;
    const m = seg.match(/^(\d+)\s*-\s*(\d+)$/);
    if (m) {
      const a = Number(m[1]), b = Number(m[2]);
      for (let i = a; i <= b; i++) out.add(i);
    } else if (/^\d+$/.test(seg)) {
      out.add(Number(seg));
    }
  }
  return out;
}

export function _loadRedLetterTruth(): Promise<void> {
  // Dedupe concurrent callers: every entrant gets the same in-flight
  // Promise. Without this, two simultaneous calls each kick off their
  // own fetch — and a loadMulti that fires before module-init's fetch
  // resolves can see _truthLoaded=false, start a parallel load, and
  // then race to populate RED_LETTER_TRUTH. The race manifested as
  // empty truth sets for the very first chapter view post-cold-start.
  if (_truthLoaded) return Promise.resolve();
  if (_truthLoadPromise) return _truthLoadPromise;
  _truthLoadPromise = (async () => {
    try {
      const r = await fetch("data/red-letter.json", { cache: "force-cache" });
      if (!r.ok) { _truthLoaded = true; return; }
      const raw = await r.json() as Record<string, unknown>;
      for (const k of Object.keys(raw)) {
        if (k.startsWith("_")) continue;          // doc fields
        if (typeof raw[k] !== "string") continue;
        RED_LETTER_TRUTH[k] = parseRange(raw[k] as string);
        // The covered-book set follows the data — new books paint without a code change.
        const dot = k.indexOf(".");
        if (dot > 0) RED_LETTER_BOOKS.add(k.slice(0, dot));
      }
    } catch { /* swallow — heuristic still works */ }
    _truthLoaded = true;
  })();
  return _truthLoadPromise;
}
// Kick off load immediately at module init.
_loadRedLetterTruth();

function truthFor(bookId: string, chapter: number): Set<number> | undefined {
  return RED_LETTER_TRUTH[`${bookId}.${chapter}`];
}

// ── Red-letter painter ────────────────────────────────────────────────────────
// Sole entry point. For every verse in the curated truth set, mark the
// whole verse red across every loaded translation.
export function applyRedLetter(
  verses: MultiVerseRow[],
  bookId: string,
  chapter: number,
  translations: string[],
): Set<number> {
  if (!RED_LETTER_BOOKS.has(bookId)) return new Set<number>();
  const truth = truthFor(bookId, chapter);
  if (!truth || !truth.size) return new Set<number>();
  const detected = new Set<number>();
  for (const v of verses) {
    if (!truth.has(v.n)) continue;
    v._jesusVerse = true;
    v.red = v.red ?? {};
    for (const tId of translations) {
      const text = v[tId];
      if (typeof text === "string") (v.red as Record<string, string[]>)[tId] = [text];
    }
    detected.add(v.n);
  }
  return detected;
}

// Backwards-compat shims for the previous public API. Kept so any
// external caller (or memory of the old shape) still works.
export function rlGet(bookId: string, chapter: number): Set<number> | undefined {
  const truth = truthFor(bookId, chapter);
  return truth ? new Set<number>(truth) : undefined;
}
// NOTE: preserved from legacy — deprecated noop; truth is the only source now
export function rlMerge(): void { /* deprecated — truth is the only source now */ }
export function annotateRedLetter(
  verses: MultiVerseRow[],
  bookId: string,
  translations: string[],
  chapter: number,
): Set<number> {
  return applyRedLetter(verses, bookId, chapter, translations);
}

// One-shot cleanup of legacy localStorage keys from the heuristic era.
// NOTE: preserved from legacy — these exact keys must be removed on boot
try { localStorage.removeItem("codex.redletter.verses.v1"); } catch { /* swallow */ }
try { localStorage.removeItem("codex.redletter.verses.v2"); } catch { /* swallow */ }
try { localStorage.removeItem("codex.redletter.verses.v3"); } catch { /* swallow */ }
try { localStorage.removeItem("codex.redletter.verses.v4"); } catch { /* swallow */ }
try { localStorage.removeItem("codex.redletter.endstate.v1"); } catch { /* swallow */ }

// Fetch many translations of one chapter in parallel and return a unified
// verse array: [{ n, kjv, web, bbe, … }, …].
export async function loadMulti(
  bookId: string,
  chapter: number,
  translations: string[],
): Promise<MultiVerseRow[]> {
  const results = await Promise.all(
    translations.map(t =>
      loadChapter(bookId, chapter, t).then(v => [t, v] as const).catch((e: unknown) => {
        console.warn("BIBLE load failed", t, e);
        return [t, null] as const;
      }),
    ),
  );
  const byVerse = new Map<number, MultiVerseRow>();
  let maxN = 0;
  for (const [tId, verses] of results) {
    if (!verses) continue;
    for (const v of verses) {
      // An empty verse contributes nothing but a phantom row — some
      // sources pad chapters with blank verses, and the Strong's scrub
      // can reduce a corrupt cache entry to "". Skip them entirely.
      const text = typeof v.text === "string" ? v.text : String(v.text ?? "");
      if (!text.trim()) continue;
      if (!byVerse.has(v.n)) byVerse.set(v.n, { n: v.n });
      (byVerse.get(v.n) as MultiVerseRow)[tId] = text;
      if (v.n > maxN) maxN = v.n;
    }
  }
  const out: MultiVerseRow[] = [];
  for (let n = 1; n <= maxN; n++) { const row = byVerse.get(n); if (row) out.push(row); }

  // Truth dataset is async — make sure it's loaded BEFORE the book-set
  // check, because RED_LETTER_BOOKS itself is derived from the dataset.
  await _loadRedLetterTruth();
  if (RED_LETTER_BOOKS.has(bookId)) {
    applyRedLetter(out, bookId, chapter, translations);
  }
  return out;
}

// ── Offline translation download ──────────────────────────────────────────────
// Shared worker-pool runner for downloadAll / repairTranslation.
const DOWNLOAD_CONCURRENCY = 4;

interface PoolTask {
  bookId: string;
  book: string;
  chapter: number;
}

function runWithPool(
  tasks: PoolTask[],
  worker: (task: PoolTask) => Promise<void>,
  onProgress?: DownloadProgressCallback,
): DownloadController {
  let aborted = false;
  let done = 0;
  const total = tasks.length;
  let cursor = 0;
  const workers = Array.from({ length: Math.min(DOWNLOAD_CONCURRENCY, total) }, async () => {
    while (!aborted) {
      const idx = cursor++;
      if (idx >= tasks.length) return;
      const task = tasks[idx];
      if (!task) return;
      try {
        await worker(task);
      } catch (e: unknown) {
        onProgress?.({ done, total, error: String((e as Error).message ?? e), book: task.book, chapter: task.chapter });
      }
      done++;
      onProgress?.({ done, total, book: task.book, chapter: task.chapter });
    }
  });
  Promise.all(workers).then(() => {
    if (aborted) onProgress?.({ done, total, aborted: true });
    else         onProgress?.({ done, total, complete: true });
  }).catch(() => {});
  return { abort: () => { aborted = true; } };
}

export function downloadAll(
  translation: string,
  books: BibleBook[],
  onProgress?: DownloadProgressCallback,
): DownloadController {
  const tasks: PoolTask[] = [];
  for (const b of books) {
    for (let ch = 1; ch <= b.chapters; ch++) {
      tasks.push({ bookId: b.id, book: b.name, chapter: ch });
    }
  }
  return runWithPool(
    tasks,
    (t) => loadChapter(t.bookId, t.chapter, translation).then(() => undefined),
    onProgress,
  );
}

// Quick lookup: how many chapters of this translation are already in cache?
export function cacheStats(translation: string, books: BibleBook[]): CacheStats {
  const cache = readCache();
  let cached = 0;
  let total  = 0;
  for (const b of books) {
    total += b.chapters;
    for (let ch = 1; ch <= b.chapters; ch++) {
      if (cache[`${b.id}.${ch}.${translation}`]) cached++;
    }
  }
  return { cached, total, fully: cached === total };
}

// Verify a translation is coherently cached for offline use:
// - Reads the cache directly (no network)
// - Returns counts + a list of the first N missing chapters
// - Spot-checks that the cached entries are parseable verse arrays
export function verifyTranslation(translation: string, books: BibleBook[]): VerifyResult {
  const cache = readCache();
  const missing: MissingChapter[] = [];
  const corrupt: MissingChapter[] = [];
  let cached = 0;
  let total  = 0;
  for (const b of books) {
    for (let ch = 1; ch <= b.chapters; ch++) {
      total++;
      const k = `${b.id}.${ch}.${translation}`;
      const v = cache[k];
      if (!v) {
        // Collect ALL missing so repairTranslation can fetch everything
        // in one go (was capped at 50, leaving the user with a button
        // labelled "REPAIR 1187" that actually only repaired 50 per click).
        missing.push({ bookId: b.id, book: b.name, chapter: ch });
        continue;
      }
      if (!Array.isArray(v) || v.length === 0 || typeof v[0]?.text !== "string") {
        corrupt.push({ bookId: b.id, book: b.name, chapter: ch });
        continue;
      }
      cached++;
    }
  }
  return {
    translation,
    cached, total,
    missing, corrupt,
    ok: missing.length === 0 && corrupt.length === 0,
    summary: missing.length === 0 && corrupt.length === 0
      ? "all chapters present and readable"
      : `${missing.length} missing · ${corrupt.length} corrupt`,
  };
}

// Repair a translation: re-fetch every missing or corrupt chapter,
// honouring the same throttle as downloadAll.
export function repairTranslation(
  translation: string,
  books: BibleBook[],
  onProgress?: DownloadProgressCallback,
): DownloadController {
  const v = verifyTranslation(translation, books);
  const targets = [...v.missing, ...v.corrupt];
  if (targets.length === 0) {
    onProgress?.({ done: 0, total: 0, complete: true, nothingToDo: true });
    return { abort: () => {} };
  }
  // Pre-clear corrupt entries so the loadChapter fetch path runs.
  if (v.corrupt.length) {
    for (const t of v.corrupt) {
      const k = `${t.bookId}.${t.chapter}.${translation}`;
      delete _memCache[k];
      _dirty.delete(k);
      if (_db) _idbReq(STORE_CHAPTERS, "readwrite", s => { s.delete(k); }).catch(() => {});
    }
  }
  let aborted = false;
  let masterDone = 0;
  const masterTotal = targets.length;
  const ctl: DownloadController = { abort: () => { aborted = true; } };
  // ── Pass 1 · concurrent worker pool (fast) ────────────────────────
  const innerCtl = runWithPool(
    targets,
    (t) => loadChapter(t.bookId, t.chapter, translation).then(() => undefined),
    (p) => {
      if (aborted) return;
      if (!p.complete && !p.aborted) {
        masterDone = p.done;
        onProgress?.({ done: masterDone, total: masterTotal, book: p.book, chapter: p.chapter, error: p.error, phase: "pool" });
        return;
      }
      // Pass 1 finished — kick off Pass 2 sequential retry for anything
      // still missing. Then Pass 3 is a checksum-style integrity sweep.
      (async () => {
        // Allow the debounced flush to drain so verify sees latest state.
        await new Promise<void>(r => setTimeout(r, 250));
        const mid = verifyTranslation(translation, books);
        const stragglers = [...mid.missing, ...mid.corrupt];
        let pass2Done = 0;
        for (const t of stragglers) {
          if (aborted) break;
          // Clear any corrupt cached entry first
          const k = `${t.bookId}.${t.chapter}.${translation}`;
          if (mid.corrupt.find(c => c.bookId === t.bookId && c.chapter === t.chapter)) {
            delete _memCache[k]; _dirty.delete(k);
            if (_db) try { await _idbReq(STORE_CHAPTERS, "readwrite", s => { s.delete(k); }); } catch { /* swallow */ }
          }
          try { await loadChapter(t.bookId, t.chapter, translation); }
          catch (e: unknown) {
            onProgress?.({ done: masterDone, total: masterTotal, book: t.book, chapter: t.chapter, error: String((e as Error).message ?? e), phase: "retry" });
          }
          pass2Done++;
          onProgress?.({ done: masterDone, total: masterTotal, retryDone: pass2Done, retryTotal: stragglers.length, phase: "retry" });
          await new Promise<void>(r => setTimeout(r, 100));   // gentler pacing
        }
        // ── Pass 3 · checksum ─────────────────────────────────────
        await new Promise<void>(r => setTimeout(r, 250));
        const final = verifyTranslation(translation, books);
        let totalVerses = 0;
        for (const k of Object.keys(_memCache)) {
          if (!k.endsWith(`.${translation}`)) continue;
          const verses = _memCache[k];
          if (Array.isArray(verses)) totalVerses += verses.length;
        }
        onProgress?.({
          done: masterDone, total: masterTotal,
          complete: true,
          checksum: {
            cached: final.cached,
            total: final.total,
            missing: final.missing.length,
            corrupt: final.corrupt.length,
            totalVerses,
            passed: final.missing.length === 0 && final.corrupt.length === 0,
          },
        });
      })();
    },
  );
  ctl.abort = () => { aborted = true; innerCtl.abort(); };
  return ctl;
}

export function readOffline(bookId: string, chapter: number, translation: string): VerseEntry[] | null {
  const cache = ensureCache();
  return cache[`${bookId}.${chapter}.${translation}`] ?? null;
}

// Drop every cached chapter for a translation.
export function removeTranslation(translation: string): number {
  let removed = 0;
  for (const k of Object.keys(_memCache)) {
    if (k.endsWith(`.${translation}`)) { delete _memCache[k]; removed++; _dirty.delete(k); }
  }
  if (_db) {
    // Sweep matching keys out of IDB via the index.
    try {
      const tx = _db.transaction(STORE_CHAPTERS, "readwrite");
      const idx = tx.objectStore(STORE_CHAPTERS).index("translation");
      const req = idx.openCursor(IDBKeyRange.only(translation));
      req.onsuccess = (e: Event) => {
        const c = (e.target as IDBRequest<IDBCursorWithValue | null>).result;
        if (c) { c.delete(); c.continue(); }
      };
    } catch (e: unknown) { console.warn("removeTranslation IDB sweep failed:", e); }
  } else {
    // Fallback: rewrite localStorage blob.
    try {
      const raw = JSON.parse(localStorage.getItem(CACHE_KEY) ?? "{}") as Record<string, unknown>;
      for (const k of Object.keys(raw)) if (k.endsWith(`.${translation}`)) delete raw[k];
      localStorage.setItem(CACHE_KEY, JSON.stringify(raw));
    } catch { /* swallow */ }
  }
  return removed;
}

// ── Storage diagnostics ───────────────────────────────────────────────────────
export async function diagnoseStorage(): Promise<StorageDiagnostics> {
  const counts: Record<string, number> = {};
  let approxBytes = 0;
  for (const [k, v] of Object.entries(_memCache)) {
    const t = k.split(".").pop() ?? "";
    counts[t] = (counts[t] ?? 0) + 1;
    // Cheap upper-bound on size: serialized length × 1 byte/char.
    if (Array.isArray(v)) approxBytes += JSON.stringify(v).length + k.length + 60;
  }
  let quota: number | null | undefined = null;
  let used: number | null | undefined = null;
  if (navigator.storage?.estimate) {
    try { const e = await navigator.storage.estimate(); quota = e.quota; used = e.usage; } catch { /* swallow */ }
  }
  return {
    backend: _db ? "indexeddb" : "localStorage-fallback",
    chapterCount: Object.keys(_memCache).length,
    countsByTranslation: counts,
    approxBytes,
    approxKB: Math.round(approxBytes / 1024),
    approxMB: +(approxBytes / 1024 / 1024).toFixed(2),
    quotaBytes: quota,
    quotaMB: quota != null ? +(quota / 1024 / 1024).toFixed(0) : null,
    usedBytes: used,
    usedMB: used != null ? +(used / 1024 / 1024).toFixed(2) : null,
    availableMB: (quota != null && used != null) ? +((quota - used) / 1024 / 1024).toFixed(0) : null,
    ready: !!_db,
  };
}

// Force re-evaluation of bundle availability.
export function resetBundle(translation?: string): void {
  if (translation) _bundleStatus.delete(translation);
  else _bundleStatus.clear();
}

// ── Check upstream for translation updates ────────────────────────────────────
let _bollsManifestCache: Map<string, { name: string; updated: unknown }> | null = null;

async function _fetchBollsManifest(): Promise<Map<string, { name: string; updated: unknown }> | null> {
  if (_bollsManifestCache) return _bollsManifestCache;
  try {
    const r = await fetch("https://bolls.life/static/bolls/app/views/languages.json");
    if (!r.ok) return null;
    const data = await r.json() as Array<{ translations?: Array<{ short_name?: string; full_name?: string; updated?: unknown }> }>;
    const m = new Map<string, { name: string; updated: unknown }>();
    for (const lang of data) {
      for (const t of (lang.translations ?? [])) {
        if (t.short_name) m.set(t.short_name, { name: t.full_name ?? "", updated: t.updated });
      }
    }
    _bollsManifestCache = m;
    return m;
  } catch { return null; }
}

export async function checkUpdates(translations: BibleTranslationEntry[]): Promise<TranslationUpdateInfo[]> {
  if (_ready) await _ready;
  const out: TranslationUpdateInfo[] = [];
  const bolls = await _fetchBollsManifest();
  for (const t of translations) {
    // Find oldest fetchedAt for any chapter of this translation
    let oldest: number | null = null;
    let chCount = 0;
    // Pull from IDB to get accurate fetchedAt (memCache only stores verses)
    if (_db) {
      try {
        await new Promise<void>((resolve, reject) => {
          if (!_db) { resolve(); return; }
          const tx = _db.transaction(STORE_CHAPTERS, "readonly");
          const idx = tx.objectStore(STORE_CHAPTERS).index("translation");
          const cr = idx.openCursor(IDBKeyRange.only(t.id));
          cr.onsuccess = (e: Event) => {
            const c = (e.target as IDBRequest<IDBCursorWithValue | null>).result;
            if (c) {
              chCount++;
              const ts = (c.value as CachedChapterRecord).fetchedAt;
              if (ts && (!oldest || ts < oldest)) oldest = ts;
              c.continue();
            } else {
              resolve();
            }
          };
          cr.onerror = () => { reject(cr.error); };
        });
      } catch { /* swallow */ }
    }
    if (chCount === 0) continue;   // not downloaded
    let sourceUpdated: unknown = null;
    let hasUpdate = false;
    let source: string | null = null;
    if (t.source === "bolls" && bolls && t.apiId && bolls.has(t.apiId)) {
      sourceUpdated = bolls.get(t.apiId)!.updated;
      source = "bolls";
      hasUpdate = !!(oldest && sourceUpdated && (sourceUpdated as number) > oldest);
    } else if (t.source === "bible-api") {
      source = "bible-api";   // no version info available
    } else {
      source = t.source ?? "unknown";
    }
    out.push({
      id: t.id, name: t.name, source,
      chaptersCached: chCount,
      ourFetchedAt: oldest,
      sourceUpdatedAt: sourceUpdated,
      hasUpdate,
      ageDays: oldest ? Math.floor((Date.now() - oldest) / 86400_000) : null,
    });
  }
  return out;
}

// ── Bundle import · accept a {translation, version, chapters} payload
// and write every chapter into IDB + mem cache.
export async function importBundle(input: string | BundlePayload): Promise<{ translation: string; imported: number }> {
  if (_ready) await _ready;
  let data: unknown;
  if (typeof input === "string") {
    try { data = JSON.parse(input); } catch (e: unknown) { throw new Error("invalid JSON: " + (e as Error).message); }
  } else { data = input; }
  if (!data || typeof data !== "object") throw new Error("bundle must be an object");
  const obj = data as Record<string, unknown>;
  const t = obj["translation"];
  if (!t || typeof t !== "string") throw new Error("missing translation id");
  if (!obj["chapters"] || typeof obj["chapters"] !== "object") throw new Error("missing chapters object");
  const now = Date.now();
  const batch: BatchEntry[] = [];
  let count = 0;
  for (const [bookCh, verses] of Object.entries(obj["chapters"] as Record<string, unknown>)) {
    if (!Array.isArray(verses) || verses.length === 0) continue;
    const key = `${bookCh}.${t}`;
    _memCache[key] = verses as VerseEntry[];
    batch.push({ key, value: { verses: verses as VerseEntry[], fetchedAt: now, source: "imported-bundle", pinned: true, translation: t } });
    count++;
  }
  if (_db && batch.length) await _putBatch(batch);
  try { window.dispatchEvent(new CustomEvent("codex:bible:bundle-loaded", { detail: { translation: t, count } })); } catch { /* swallow */ }
  return { translation: t, imported: count };
}

// ── Bundle export ─────────────────────────────────────────────────────────────
// Reads every cached chapter for `translation` from the mem mirror and
// returns an object in the bundle format the loader expects.
export function exportBundle(translation: string): ExportedBundle {
  const chapters: Record<string, VerseEntry[]> = {};
  for (const [k, verses] of Object.entries(_memCache)) {
    if (!k.endsWith(`.${translation}`)) continue;
    const parts = k.split(".");
    // key shape: bookId.chapter.translation → strip trailing translation
    const bookCh = parts.slice(0, -1).join(".");
    chapters[bookCh] = verses;
  }
  return {
    translation,
    version: 1,
    generatedAt: Date.now(),
    chapterCount: Object.keys(chapters).length,
    chapters,
  };
}

// Invalidate _memCache entries for a translation when its source changes.
// NOTE: preserved from legacy — guard for typeof window keeps SSR/Node safe
if (typeof window !== "undefined") {
  window.addEventListener("codex:translations-changed", (e: Event) => {
    try {
      const detail = (e as CustomEvent<{ id?: string }>).detail;
      const id = detail?.id;
      if (!id) return;
      const suffix = "." + id;
      for (const k of Object.keys(_memCache)) {
        if (k.endsWith(suffix)) delete _memCache[k];
      }
    } catch { /* swallow */ }
  });
}

// ── Expose _memCache / _db for test access ────────────────────────────────────
// (Named exports keep the module tree-shakeable; tests import them directly.)
export { _memCache, _db };
