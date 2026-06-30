// panels-gen — typed window boundary. All runtime global accesses go through
// pw() so the rest of the code never touches `window as any`.
// Mirrors the pattern established in gematria-window.ts / data-window.ts.
import type {
  Engine,
  PanelData,
  ExegesisData,
  TxAnalysisData,
  DisarmData,
  QuestModule,
  CacheStatEntry,
  PanelListener,
  TranslationInput,
  LoadOpts,
  ExegesisOpts,
  TxAnalysisOpts,
  DisarmOpts,
  QuestGenOpts,
} from "./types.js";

// ── CODEX_PANELS shape ─────────────────────────────────────────────────────────
// Faithfully mirrors the object the legacy IIFE assigned to window.CODEX_PANELS.
export interface CodexPanels {
  cacheKey(bookId: string, chapter: string | number, engine?: Partial<Engine>): string;
  getCached(bookId: string, chapter: string | number, engine?: Partial<Engine>): PanelData | null;
  getCachedMeta(bookId: string, chapter: string | number, engine?: Partial<Engine>): { fetchedAt: number } | null;
  putCached(bookId: string, chapter: string | number, data: PanelData, engine?: Partial<Engine>): void;
  purge(bookId: string, chapter: string | number, engine?: Partial<Engine>): void;
  load(bookId: string, chapter: string | number, bookName: string, opts?: LoadOpts): Promise<PanelData>;
  subscribe(fn: PanelListener): () => void;
  cacheStats(): CacheStatEntry[];

  loadExegesis(passageKey: string, opts?: ExegesisOpts): Promise<ExegesisData>;
  getExegesisCached(passageKey: string, engine?: Partial<Engine>): ExegesisData | null;
  getExegesisMeta(passageKey: string, engine?: Partial<Engine>): { fetchedAt: number } | null;
  purgeExegesis(passageKey: string, engine?: Partial<Engine>): void;

  loadTranslationAnalysis(passageKey: string, translations: TranslationInput[], opts?: TxAnalysisOpts): Promise<TxAnalysisData>;
  getTxAnalysisCached(passageKey: string, translationIds: string[], engine?: Partial<Engine>): TxAnalysisData | null;
  getTxAnalysisMeta(passageKey: string, translationIds: string[], engine?: Partial<Engine>): { fetchedAt: number } | null;
  purgeTxAnalysis(passageKey: string, translationIds: string[], engine?: Partial<Engine>): void;

  loadDisarm(opts?: DisarmOpts): Promise<DisarmData>;
  getDisarmCached(bookId: string, chapter: string | number, engine?: Partial<Engine>): DisarmData | null;
  getDisarmMeta(bookId: string, chapter: string | number, engine?: Partial<Engine>): { fetchedAt: number } | null;
  purgeDisarm(bookId: string, chapter: string | number, engine?: Partial<Engine>): void;

  generateQuest(theme: string, opts?: QuestGenOpts): Promise<QuestModule>;
  getQuestGenCached(theme: string, opts?: QuestGenOpts, engine?: Partial<Engine>): QuestModule | null;
  getQuestGenMeta(theme: string, opts?: QuestGenOpts, engine?: Partial<Engine>): { fetchedAt: number } | null;
  purgeQuestGen(theme: string, opts?: QuestGenOpts, engine?: Partial<Engine>): void;
  fallbackQuest(theme: string, opts?: QuestGenOpts): QuestModule;
}

// ── CODEX_PANELS_ENGINE shape ──────────────────────────────────────────────────
// A display-hint read by the UI and set as a side-effect inside load*() paths.
// The authoritative engine for each call is always derived from that call's own
// opts (Bug D fix, preserved faithfully from legacy). Not used as cache authority.
export type CodexPanelsEngine = Partial<Engine>;

// ── CODEX_QUESTGEN shape ───────────────────────────────────────────────────────
// The engagement contract. panels-gen.js installs `generate` with an `||` guard:
//   - CODEX_QUESTGEN is initialised to {} only if it is falsy/non-object.
//   - generate is only set if it isn't already a function.
// engagement.js may pre-install a `register` method and its own stub; we never
// clobber anything already present (load-order preserved per integration contract).
export interface CodexQuestGen {
  generate?: (theme: string, opts?: QuestGenOpts) => Promise<QuestModule>;
  // engagement.js may add further properties (register, DOMAINS, etc.)
  [key: string]: unknown;
}

// ── Globals this module READS (but does not own) ───────────────────────────────

export interface CodexEngage {
  trackPanel(): void;
}

export interface CodexEngagement {
  DOMAINS?: string[];
}

export interface CodexAiDefault {
  provider?: string;
  model?: string;
}

// ── Full typed window boundary ─────────────────────────────────────────────────
export interface PanelsGenWindow {
  // Globals this module SETS
  CODEX_PANELS?: CodexPanels;
  CODEX_PANELS_ENGINE?: CodexPanelsEngine;
  CODEX_QUESTGEN?: CodexQuestGen;
  // Globals this module READS
  CODEX_LANG?: string;
  codexLangName?: () => string;
  CODEX_AI_DEFAULT?: CodexAiDefault;
  CODEX_ENGAGE?: CodexEngage;
  CODEX_ENGAGEMENT?: CodexEngagement;
  // CODEX_DATA is present in the global environment; this module does not access it.
  CODEX_DATA?: Record<string, unknown>;
}

export function pw(): PanelsGenWindow {
  return window as unknown as PanelsGenWindow;
}
