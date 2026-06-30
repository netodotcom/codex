// search — shared types for the CODEX_SEARCH engine.

// ── window.CODEX_DATA slice ───────────────────────────────────────────────────
export interface BookRecord {
  id: string;
  name: string;
  aliases?: string[] | undefined;
}

// ── Input types for public ingest API ────────────────────────────────────────

/** Verse entry inside a refsObject passed to index(). */
export interface VerseRecord {
  n: number | string;
  text?: string | null | undefined;
}

/** Verse entry inside a Passage (may have per-translation string keys). */
export interface PassageVerse {
  n?: number | string | null | undefined;
  red?: unknown;
  _jesusVerse?: unknown;
  text?: string | undefined;
  [key: string]: unknown;
}

/** Passage object consumed by ingestPassage(). */
export interface Passage {
  bookId: string;
  chapter: number | string;
  verses: PassageVerse[];
  primary?: string | undefined;
}

// ── Internal engine state ─────────────────────────────────────────────────────

/** Full in-memory document record. */
export interface SearchDoc {
  id: number;
  ref: string;
  translation: string;
  text: string;
  tokensLower: string[];
}

/** Minimal record persisted to IDB (tokensLower re-derived on load). */
export interface StoredDoc {
  ref: string;
  translation: string;
  text: string;
}

// ── Search output ─────────────────────────────────────────────────────────────

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
  limit?: number | undefined;
}

// ── Semantic (concept) search ─────────────────────────────────────────────────

/** Raw item from the AI JSON response. */
export interface RawSemanticItem {
  ref: string;
  passage_text?: string | undefined;
  relevance?: string | undefined;
  score?: number | undefined;
}

export interface ConceptResult {
  ref: string;
  bookId: string | null;
  chapter: number | null;
  verse: number | null;
  text: string;
  relevance: string;
  score: number;
}

export interface SemanticSearchOpts {
  lang?: string | undefined;
  force?: boolean | undefined;
  provider?: string | undefined;
  model?: string | undefined;
}

export interface SemanticSearchResult {
  results: ConceptResult[];
  fromCache: boolean;
  ts?: number | undefined;
}

export interface ConceptCacheEntry {
  ts: number;
  results: ConceptResult[];
}

// ── Public API surface (window.CODEX_SEARCH) ─────────────────────────────────

export interface SearchStats {
  translations: number;
  translationList: string[];
  verses: number;
  indexedAt: number;
  built: boolean;
}

export interface ParsedQuery {
  tokens: string[];
  wildcards: string[];
  phrases: string[];
  translation: string | null;
}

export interface CodexSearchApi {
  index(translation: string, refsObject: Record<string, unknown[]>): number | undefined;
  ingestPassage(passage: Passage): number;
  search(query: string, opts?: SearchOpts): Promise<SearchResult[]>;
  clear(): void;
  stats(): SearchStats;
  ready: Promise<void>;
  searchSemantic(query: string, opts?: SemanticSearchOpts): Promise<SemanticSearchResult>;
}

// ── SearchBar component ───────────────────────────────────────────────────────

export interface SearchBarProps {
  open: boolean;
  onClose?: (() => void) | undefined;
  onNavigate?: ((bookId: string, chapter: number | null, verse: number | null) => void) | undefined;
}

// ── localStorage tweaks blob ──────────────────────────────────────────────────

export interface TweaksBlob {
  primaryTranslation?: string | undefined;
  provider?: string | undefined;
  model?: string | undefined;
}

// ── Error with kind discriminant (thrown by searchSemantic) ──────────────────

export interface SearchApiError {
  kind?: string | undefined;
  message?: string | undefined;
}

// ── Parsed human reference (e.g. "John 3:16") ────────────────────────────────

export interface ParsedHumanRef {
  bookId: string | null;
  bookName: string;
  chapter: number;
  verse: number;
}
