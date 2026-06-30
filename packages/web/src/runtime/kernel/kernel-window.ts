// kernel — typed window boundary. All runtime global accesses go through
// kw() so the rest of the code never touches `window as any`.
// Mirrors the pattern established in modules-window.ts / gematria-window.ts.
import type {
  CodexKernelApi,
  StrongsEntry,
  StrongsEntries,
  TimelineEvent,
} from "./types.js";

// ── Minimal slice of window.CODEX_DATA ───────────────────────────────────────
export interface CodexDataBook {
  id: string;
  name: string;
}

export interface CodexDataTranslation {
  id: string;
}

export interface CodexDataSlice {
  books?: CodexDataBook[];
  translations?: CodexDataTranslation[];
  tweaks?: { primary?: string };
}

// ── Minimal slice of window.BIBLE ────────────────────────────────────────────
export interface BibleVerse {
  verse?: number;
  n?: number;
  text?: string;
}

export interface BibleChapterResult {
  verses?: BibleVerse[];
}

export interface BibleSlice {
  loadChapter(
    bookId: string,
    chapter: number,
    translation: string,
  ): Promise<BibleChapterResult | BibleVerse[]>;
}

// ── Minimal slice of window.CODEX_SEARCH ─────────────────────────────────────
export interface SearchHit {
  ref?: string;
  id?: string;
  text?: string;
  snippet?: string;
}

export interface CodexSearchSlice {
  search(query: string, opts?: { limit?: number }): Promise<SearchHit[]>;
  searchSemantic?: (query: string, opts?: { limit?: number }) => Promise<SearchHit[]>;
}

// ── Minimal slice of window.CODEX_CrossRefLookup ─────────────────────────────
export interface CrossRefItem {
  ref?: string;
}

export interface CodexCrossRefSlice {
  getCrossRefs(key: string): Promise<CrossRefItem[]>;
  formatRef?: (r: CrossRefItem | string) => string;
}

// ── Minimal slice of window.CODEX_GEMATRIA ───────────────────────────────────
export interface CodexGematriaSlice {
  all(text: string): unknown;
}

// ── Minimal slice of window.CODEX_MODULES ────────────────────────────────────
// loadModule can return different shapes; callers narrow via duck-typing.
export interface StrongsModuleShape {
  entries?: StrongsEntries;
}

export interface EastonEntry {
  title?: string;
  body?: string;
  refs?: string[];
}

export interface EastonModuleShape {
  entries?: Record<string, EastonEntry>;
}

export interface TimelineModuleShape {
  events?: TimelineEvent[];
}

export type AnyModuleShape = StrongsModuleShape | EastonModuleShape | TimelineModuleShape;

export interface CodexModulesSlice {
  loadModule(id: string): Promise<AnyModuleShape>;
}

// ── Minimal slice of window.CODEX_Timeline ───────────────────────────────────
export interface CodexTimelineSlice {
  loadEvents(): Promise<TimelineEvent[]>;
}

// ── Minimal slice of window.CODEX_INTEL ──────────────────────────────────────
export interface IntelEngine {
  provider: string;
  model?: string;
}

export interface CodexIntelSlice {
  intelEngine(): IntelEngine;
  intelErrMessage(body: unknown, status: number): string;
  intelParseJSON(text: string): Record<string, unknown>;
}

// ── Minimal slice of window.CODEX_AI_BUSY ────────────────────────────────────
export interface CodexAiBusySlice {
  begin(label: string): unknown;
  end(id: unknown): void;
}

// ── Minimal slice of window.CODEX_ARTIFACTS ──────────────────────────────────
export interface CodexArtifactsSlice {
  directiveDoc(): string;
}

// ── Minimal slice of window.codexDesk ────────────────────────────────────────
export interface CodexDeskSlice {
  open(id: string): void;
  focus(on: boolean): void;
}

// ── Minimal slice of window.codexDeskPanels ──────────────────────────────────
export interface CodexDeskPanelsSlice {
  open(id: string): void;
}

// ── Window globals this module SETS ──────────────────────────────────────────
//   window.CODEX_KERNEL
// ── Window globals this module READS ─────────────────────────────────────────
//   window.CODEX_DATA, window.BIBLE, window.CODEX_SEARCH,
//   window.CODEX_CrossRefLookup, window.CODEX_GEMATRIA, window.CODEX_MODULES,
//   window.CODEX_Timeline, window.CODEX_INTEL, window.CODEX_AI_BUSY,
//   window.CODEX_ARTIFACTS, window.CODEX_StrongsLookup,
//   window.codexJumpToRef, window.codexSetPrimary,
//   window.codexDesk, window.codexDeskPanels
export interface KernelWindow {
  // SET by this module
  CODEX_KERNEL?: CodexKernelApi;
  // READ by other engines; accessed here for tool wiring
  CODEX_DATA?: CodexDataSlice;
  BIBLE?: BibleSlice;
  CODEX_SEARCH?: CodexSearchSlice;
  CODEX_CrossRefLookup?: CodexCrossRefSlice;
  CODEX_GEMATRIA?: CodexGematriaSlice;
  CODEX_MODULES?: CodexModulesSlice;
  CODEX_Timeline?: CodexTimelineSlice;
  CODEX_INTEL?: CodexIntelSlice;
  CODEX_AI_BUSY?: CodexAiBusySlice;
  CODEX_ARTIFACTS?: CodexArtifactsSlice;
  CODEX_StrongsLookup?: (num: string) => StrongsEntry | null | undefined;
  codexJumpToRef?: (ref: string) => void;
  codexSetPrimary?: (id: string) => void;
  codexDesk?: CodexDeskSlice;
  codexDeskPanels?: CodexDeskPanelsSlice;
}

export function kw(): KernelWindow {
  return window as unknown as KernelWindow;
}
