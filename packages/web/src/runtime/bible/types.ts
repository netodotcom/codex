// bible — shared TypeScript types. Faithfully mirrors the shape used by
// legacy/bible.js (window.BIBLE) and the CODEX_DATA slice it reads.

// ── Verse types ───────────────────────────────────────────────────────────────

/** A single verse returned by a source API or read from cache. */
export interface VerseEntry {
  n: number;
  text: string;
}

/** A merged multi-translation verse row (n + one key per translation id). */
export interface MultiVerseRow {
  n: number;
  _jesusVerse?: boolean;
  red?: Record<string, string[]>;
  [translationId: string]: number | boolean | string | string[] | Record<string, string[]> | undefined;
}

// ── Storage types ─────────────────────────────────────────────────────────────

/** Shape stored in IDB objectStore "chapters". */
export interface CachedChapterRecord {
  verses: VerseEntry[];
  fetchedAt: number;
  source: string;
  pinned: boolean;
  translation: string;
}

/** In-memory mirror: cacheKey → verses array. */
export type MemCache = Record<string, VerseEntry[]>;

/** One entry in a _putBatch call. */
export interface BatchEntry {
  key: string;
  value: CachedChapterRecord;
}

// ── CODEX_DATA slice read by bible ────────────────────────────────────────────

export interface BibleTranslationMirror {
  readonly kind: "bible-api" | "bolls";
  readonly apiId: string;
}

export interface BibleTranslationEntry {
  readonly id: string;
  readonly name?: string;
  readonly source?: string;
  readonly apiId?: string;
  readonly projectId?: string;
  readonly mirrors?: BibleTranslationMirror[];
  readonly bundle?: string | boolean;
  readonly placeholder?: boolean;
}

export interface BibleCodexDataSlice {
  readonly translations?: BibleTranslationEntry[];
}

// ── Source resolution ─────────────────────────────────────────────────────────

export interface SourceEntry {
  kind: string;
  apiId: string;
  projectId?: string;
  bundleUrl?: string;
}

// ── Download / repair progress ────────────────────────────────────────────────

export interface DownloadProgressEvent {
  done: number;
  total: number;
  book?: string;
  chapter?: number;
  complete?: boolean;
  aborted?: boolean;
  nothingToDo?: boolean;
  error?: string;
  phase?: "pool" | "retry";
  retryDone?: number;
  retryTotal?: number;
  checksum?: {
    cached: number;
    total: number;
    missing: number;
    corrupt: number;
    totalVerses: number;
    passed: boolean;
  };
}

export type DownloadProgressCallback = (p: DownloadProgressEvent) => void;

export interface DownloadController {
  abort(): void;
}

// ── cacheStats / verifyTranslation ────────────────────────────────────────────

export interface CacheStats {
  cached: number;
  total: number;
  fully: boolean;
}

export interface MissingChapter {
  bookId: string;
  book: string;
  chapter: number;
}

export interface VerifyResult {
  translation: string;
  cached: number;
  total: number;
  missing: MissingChapter[];
  corrupt: MissingChapter[];
  ok: boolean;
  summary: string;
}

// ── Book record (minimal, for downloadAll / cacheStats) ──────────────────────

export interface BibleBook {
  id: string;
  name: string;
  chapters: number;
}

// ── checkUpdates ──────────────────────────────────────────────────────────────

export interface TranslationUpdateInfo {
  id: string;
  name: string | undefined;
  source: string | null;
  chaptersCached: number;
  ourFetchedAt: number | null;
  sourceUpdatedAt: unknown;
  hasUpdate: boolean;
  ageDays: number | null;
}

// ── importBundle / exportBundle ───────────────────────────────────────────────

export interface BundlePayload {
  translation: string;
  version?: number;
  chapters: Record<string, VerseEntry[]>;
}

export interface ExportedBundle {
  translation: string;
  version: 1;
  generatedAt: number;
  chapterCount: number;
  chapters: Record<string, VerseEntry[]>;
}

// ── Storage diagnostics ───────────────────────────────────────────────────────

export interface StorageDiagnostics {
  backend: "indexeddb" | "localStorage-fallback";
  chapterCount: number;
  countsByTranslation: Record<string, number>;
  approxBytes: number;
  approxKB: number;
  approxMB: number;
  quotaBytes: number | null | undefined;
  quotaMB: number | null;
  usedBytes: number | null | undefined;
  usedMB: number | null;
  availableMB: number | null;
  ready: boolean;
}

// ── Public BIBLE API surface ──────────────────────────────────────────────────

export interface BibleStorageApi {
  diagnose(): Promise<StorageDiagnostics>;
  resetBundle(translation?: string): void;
  exportBundle(translation: string): ExportedBundle;
  importBundle(input: string | BundlePayload): Promise<{ translation: string; imported: number }>;
  checkUpdates(translations: BibleTranslationEntry[]): Promise<TranslationUpdateInfo[]>;
}

export interface BibleApi {
  loadChapter(bookId: string, chapter: number, translation: string): Promise<VerseEntry[]>;
  getCachedChapter(bookId: string, chapter: number, translation: string): VerseEntry[] | null;
  loadMulti(bookId: string, chapter: number, translations: string[]): Promise<MultiVerseRow[]>;
  BOOK_API: Record<string, string>;
  annotateRedLetter(verses: MultiVerseRow[], bookId: string, translations: string[], chapter: number): Set<number>;
  rlGet(bookId: string, chapter: number): Set<number> | undefined;
  rlMerge(): void;
  downloadAll(translation: string, books: BibleBook[], onProgress?: DownloadProgressCallback): DownloadController;
  cacheStats(translation: string, books: BibleBook[]): CacheStats;
  verifyTranslation(translation: string, books: BibleBook[]): VerifyResult;
  repairTranslation(translation: string, books: BibleBook[], onProgress?: DownloadProgressCallback): DownloadController;
  readOffline(bookId: string, chapter: number, translation: string): VerseEntry[] | null;
  removeTranslation(translation: string): number;
  ready: Promise<void>;
  storage: BibleStorageApi;
}
