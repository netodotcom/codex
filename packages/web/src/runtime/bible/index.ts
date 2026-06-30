// bible — entry. Assigns window.BIBLE at import time, exactly as
// legacy/bible.js IIFE. Replaces that IIFE in the Vite build
// (gen-web-entry maps it). The named exports here are the ESM equivalent
// of the legacy `return { loadChapter, ... }`.
import {
  loadChapter,
  getCachedChapter,
  loadMulti,
  BOOK_API,
  annotateRedLetter,
  rlGet,
  rlMerge,
  downloadAll,
  cacheStats,
  verifyTranslation,
  repairTranslation,
  readOffline,
  removeTranslation,
  _ready,
  diagnoseStorage,
  resetBundle,
  exportBundle,
  importBundle,
  checkUpdates,
} from "./helpers.js";
import { bw } from "./bible-window.js";
import type { BibleApi, BibleTranslationEntry } from "./types.js";

const API: BibleApi = {
  loadChapter,
  getCachedChapter,
  loadMulti,
  // NOTE: preserved from legacy — BOOK_API exposed as a defensive copy so
  // callers that mutate their reference don't affect the internal map
  BOOK_API: { ...BOOK_API },
  annotateRedLetter,
  rlGet,
  rlMerge,
  downloadAll,
  cacheStats,
  verifyTranslation,
  repairTranslation,
  readOffline,
  removeTranslation,
  ready: _ready,
  storage: {
    diagnose: diagnoseStorage,
    resetBundle,
    exportBundle,
    importBundle,
    checkUpdates: (translations: BibleTranslationEntry[]) => checkUpdates(translations),
  },
};

// NOTE: preserved from legacy — dual browser/Node guard.
// The IIFE always ran in a browser; this guard keeps the module safe in
// test/SSR environments where `window` may be absent.
if (typeof window !== "undefined") bw().BIBLE = API;

export {
  loadChapter,
  getCachedChapter,
  loadMulti,
  BOOK_API,
  annotateRedLetter,
  rlGet,
  rlMerge,
  downloadAll,
  cacheStats,
  verifyTranslation,
  repairTranslation,
  readOffline,
  removeTranslation,
};
export type {
  BibleApi,
  VerseEntry,
  MultiVerseRow,
  CacheStats,
  VerifyResult,
  BibleBook,
  DownloadController,
  DownloadProgressCallback,
  StorageDiagnostics,
  ExportedBundle,
  BundlePayload,
} from "./types.js";
