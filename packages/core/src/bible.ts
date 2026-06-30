// Scripture loader — pure helpers (book maps, cache keys, source URLs, response
// normalization). Ported from bible.js. The fetch + IndexedDB-cache orchestration
// is a later slice with its IO injected (ChapterStore + fetch), mirroring modules.ts.

import { translationById } from "./data.js";

export interface VerseRow {
  n: number;
  text: string;
}

export interface ResolvedSource {
  source: string;
  apiId: string;
}

const BOLLS_BASE = "https://bolls.life";
const BIBLE_API_BASE = "https://bible-api.com";

// bookId → bolls.life numeric book id (1=Genesis … 66=Revelation).
const BOOK_BOLLS: Record<string, number> = {
  gen: 1, exo: 2, lev: 3, num: 4, deu: 5, jos: 6, jdg: 7, rut: 8,
  "1sa": 9, "2sa": 10, "1ki": 11, "2ki": 12, "1ch": 13, "2ch": 14,
  ezr: 15, neh: 16, est: 17, job: 18, psa: 19, pro: 20, ecc: 21, sng: 22,
  isa: 23, jer: 24, lam: 25, ezk: 26, dan: 27, hos: 28, jol: 29, amo: 30,
  oba: 31, jon: 32, mic: 33, nam: 34, hab: 35, zep: 36, hag: 37, zec: 38, mal: 39,
  mat: 40, mrk: 41, luk: 42, jhn: 43, act: 44, rom: 45,
  "1co": 46, "2co": 47, gal: 48, eph: 49, php: 50, col: 51,
  "1th": 52, "2th": 53, "1ti": 54, "2ti": 55, tit: 56, phm: 57, heb: 58, jas: 59,
  "1pe": 60, "2pe": 61, "1jn": 62, "2jn": 63, "3jn": 64, jud: 65, rev: 66,
};

// bookId → bible-api.com book slug.
const BOOK_API: Record<string, string> = {
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

export function bollsBookNumber(bookId: string): number | undefined {
  return BOOK_BOLLS[bookId];
}
export function bibleApiSlug(bookId: string): string | undefined {
  return BOOK_API[bookId];
}

/** IndexedDB / mem-cache key: "<bookId>.<chapter>.<translation>" */
export function chapterKey(bookId: string, chapter: number | string, translation: string): string {
  return `${bookId}.${chapter}.${translation}`;
}

/** Resolve a translation id → its API source + remote id, via the registry. */
export function resolveTranslation(t: string): ResolvedSource {
  const reg = translationById(t);
  if (reg) return { source: reg.source || "bible-api", apiId: reg.apiId || t };
  return { source: "bible-api", apiId: t };
}

export function bollsChapterUrl(apiId: string, bookId: string, chapter: number): string {
  const bookNum = BOOK_BOLLS[bookId];
  if (!bookNum) throw new Error("Unknown book: " + bookId);
  return `${BOLLS_BASE}/get-text/${apiId}/${bookNum}/${chapter}/`;
}

export function bibleApiChapterUrl(apiId: string, bookId: string, chapter: number): string {
  const slug = BOOK_API[bookId];
  if (!slug) throw new Error("Unknown book: " + bookId);
  const isLatin = apiId === "clementine";
  const lookup = isLatin ? bookId.toUpperCase() : slug;
  return `${BIBLE_API_BASE}/${encodeURIComponent(lookup)}+${chapter}?translation=${apiId}`;
}

// bolls.life serves HTML-tagged text and leaks Strong's numbers (glued to the
// preceding word, e.g. "man444", or standalone, e.g. "man 444 that"). Strip both.
export function cleanBollsText(text: string): string {
  return String(text || "")
    .replace(/<[^>]+>/g, "")
    .replace(/(?<=[a-zA-ZéÀ-ſ'])\d+/g, "")
    .replace(/(?<=^|[\s.,;:!?()'"—–-])\d{2,5}(?=[\s.,;:!?()'"—–-]|$)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function cleanBibleApiText(text: string): string {
  return String(text || "").replace(/\s+/g, " ").trim();
}

interface BollsVerse {
  verse: number;
  text?: string;
}
interface BibleApiResponse {
  verses?: Array<{ verse: number; text?: string }>;
}

export function parseBollsResponse(data: unknown): VerseRow[] {
  const arr: BollsVerse[] = Array.isArray(data) ? (data as BollsVerse[]) : [];
  return arr.map((v) => ({ n: v.verse, text: cleanBollsText(String(v.text || "")) }));
}

export function parseBibleApiResponse(data: unknown): VerseRow[] {
  const verses = (data as BibleApiResponse | null)?.verses ?? [];
  return verses.map((v) => ({ n: v.verse, text: cleanBibleApiText(String(v.text || "")) }));
}

// ── fetch + cache orchestration (IO injected) ───────────────────────────
// Ported from bible.js loadChapter/_loadChapterFresh (network path). The
// bundle-first path and IndexedDB migration are platform glue handled when
// wiring window.BIBLE; here we cover source-chain fallback + cache + in-flight
// dedupe, which is the testable heart.

export interface SourceRef {
  kind: string;
  apiId: string;
  projectId?: string;
}

interface Chainable {
  source?: string;
  apiId?: string;
  projectId?: string;
  mirrors?: Array<{ kind: string; apiId: string }>;
}

/** Primary source followed by its mirrors, in priority order. */
export function sourceChain(t: Chainable | undefined): SourceRef[] {
  if (!t) return [];
  const chain: SourceRef[] = [];
  if (t.source && t.apiId) {
    const head: SourceRef = { kind: t.source, apiId: t.apiId };
    if (t.projectId) head.projectId = t.projectId;
    chain.push(head);
  }
  if (Array.isArray(t.mirrors)) for (const m of t.mirrors) chain.push({ kind: m.kind, apiId: m.apiId });
  return chain;
}

function chapterSourceUrl(src: SourceRef, bookId: string, chapter: number): string {
  if (src.kind === "bolls") return bollsChapterUrl(src.apiId, bookId, chapter);
  if (src.kind === "bible-api") return bibleApiChapterUrl(src.apiId, bookId, chapter);
  throw new Error("Unsupported source kind: " + src.kind);
}

function parseSourceResponse(src: SourceRef, data: unknown): VerseRow[] {
  if (src.kind === "bolls") return parseBollsResponse(data);
  if (src.kind === "bible-api") return parseBibleApiResponse(data);
  return [];
}

export interface ChapterStore {
  get(key: string): Promise<VerseRow[] | undefined>;
  put(key: string, verses: VerseRow[]): Promise<void>;
}

export interface ChapterLoaderDeps {
  store: ChapterStore;
  fetchJson: (url: string) => Promise<unknown>;
}

export interface ChapterLoader {
  loadChapter(bookId: string, chapter: number, translation: string): Promise<VerseRow[]>;
}

export function createChapterLoader(deps: ChapterLoaderDeps): ChapterLoader {
  const { store, fetchJson } = deps;
  const inflight = new Map<string, Promise<VerseRow[]>>();

  async function fresh(bookId: string, chapter: number, translation: string, key: string): Promise<VerseRow[]> {
    const chain = sourceChain(translationById(translation));
    if (chain.length === 0) throw new Error("No source for translation: " + translation);
    let lastErr: unknown = null;
    for (const src of chain) {
      try {
        const data = await fetchJson(chapterSourceUrl(src, bookId, chapter));
        const verses = parseSourceResponse(src, data);
        await store.put(key, verses);
        return verses;
      } catch (e) {
        lastErr = e;
      }
    }
    throw lastErr ?? new Error(`All sources failed for ${translation} ${bookId} ${chapter}`);
  }

  async function loadChapter(bookId: string, chapter: number, translation: string): Promise<VerseRow[]> {
    const key = chapterKey(bookId, chapter, translation);
    const cached = await store.get(key);
    if (cached) return cached;
    const existing = inflight.get(key);
    if (existing) return existing;
    const p = fresh(bookId, chapter, translation, key).finally(() => inflight.delete(key));
    inflight.set(key, p);
    return p;
  }

  return { loadChapter };
}
