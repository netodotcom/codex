// data — entry. Assigns window.CODEX_DATA at import time, exactly as
// legacy/data.js. Replaces that IIFE in the Vite build (gen-web-entry maps
// it). The named exports here are the ESM equivalent of the legacy global assignment.
import type { CodexData } from "./types.js";
import { BOOKS, TRANSLATIONS, DEFAULT_PASSAGE, SEED_PANELS } from "./helpers.js";
import { dw } from "./data-window.js";

const DATA: CodexData = {
  books: BOOKS,
  translations: TRANSLATIONS,
  defaultPassage: DEFAULT_PASSAGE,
  seedPanels: SEED_PANELS,
};

// NOTE: preserved from legacy — dual browser/Node guard matches the IIFE's
// own safety wrapper; dead code in ESM builds but preserves load-time contract.
if (typeof window !== "undefined") dw().CODEX_DATA = DATA;

export { BOOKS, TRANSLATIONS, DEFAULT_PASSAGE, SEED_PANELS };
export type {
  CodexData,
  BookEntry,
  ProtestantBook,
  DeuterocanonicalBook,
  TranslationEntry,
  TranslationMirror,
  TranslationSource,
  DefaultPassage,
  SeedPanel,
  TalmudEntry,
  CommentaryEntry,
  GematriaEntry,
  GnosisEntry,
  CrossRef,
  DisarmEntry,
  DisarmBlock,
  Canon,
  LangTag,
  CanonTag,
  OfflinePriority,
} from "./types.js";
