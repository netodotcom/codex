// crossref — typed window boundary (migrated from crossref.jsx). The panel
// reads a handful of runtime globals (the TSK module loader, books data, the
// bible cache, engagement + intel engines, the reader-navigation doors) and
// SETS a few back (the lookup helper, the panel component, the automation
// hooks). Centralise the typing here; callers use xw() and read/write what they
// need, lazily, at call time — exactly like reader-window.ts.
import type React from "react";

// ── Runtime data shapes ───────────────────────────────────────────────────
export interface CodexBook {
  id: string;
  name: string;
  testament: string | null;
}

// bible.js caches chapters as a bare verses ARRAY [{n,text}]; older code
// expected {verses:[…]} — both shapes flow through here.
export interface ChapterVerse {
  n: number;
  text?: string;
  [translation: string]: unknown;
}
export type CachedChapter = ChapterVerse[] | { verses?: ChapterVerse[] } | null | undefined;

// Full TSK stores plain string refs; the earlier sample stored { ref, theme }.
export interface TskRefObject {
  ref?: string;
  theme?: string;
  note?: string;
  votes?: number;
  w?: number;
}
export type TskRef = string | TskRefObject;
export interface TskModule {
  verses?: Record<string, TskRef[]>;
  meta?: { totalRefs?: number };
}

export interface IntelEngine {
  model?: string;
  provider?: string;
}

// ── Shared geometry / node types ──────────────────────────────────────────
export interface Pt {
  x: number;
  y: number;
}

// The canvas probe — XrefGraph writes its laid-out node positions here so the
// codexXrefState() automation hook can read them back.
export interface ProbeRef {
  pos: Record<string, Pt>;
  cx: number;
  cy: number;
}

export interface ParsedKey {
  bookId: string;
  chapter: number;
  verse: number | null;
}

export interface XrefNode {
  key: string;
  theme: string | null;
  note: string | null;
  testament: string | null;
  seam: boolean;
  strength: number | null;
  color: string;
  label: string;
  order: number;
}

// ── The exported contract (window globals we SET) ─────────────────────────
export type VerseRefInput =
  | string
  | { bookId: string; chapter: number | string; verse?: number | string };

export interface CrossRefLookup {
  getCrossRefs(verseRef: VerseRefInput): Promise<TskRef[]>;
  formatRef(key: string): string;
  parseVerseKey(key: unknown): ParsedKey | null;
}

export interface XrefStateNode {
  key: string;
  x: number | undefined;
  y: number | undefined;
}
export interface XrefState {
  center: string;
  chain: string[];
  count: number;
  nodes: XrefStateNode[];
}

export interface CrossRefPanelProps {
  book?: string;
  bookId?: string;
  chapter?: number;
  verse?: number;
  translation?: string;
}

// ── Plugin registration shapes ────────────────────────────────────────────
export interface PluginPanelSpec {
  id: string;
  label: string;
  glyph: string;
  render(ctx: Record<string, unknown>): React.ReactElement;
}
export interface PluginVerseAction {
  label: string;
  icon: string;
  handler(verseRef: unknown): void;
}
export interface CrossRefPlugin {
  id: string;
  name: string;
  version: string;
  panels: PluginPanelSpec[];
  verseActions: PluginVerseAction[];
}

// ── The window ────────────────────────────────────────────────────────────
export interface CrossRefWindow {
  CODEX_MODULES?: { loadModule(id: string): Promise<TskModule> };
  CODEX_DATA?: { books?: CodexBook[]; tweaks?: { provider?: unknown; model?: unknown } };
  BIBLE?: {
    getCachedChapter?(bookId: string, chapter: number, tr: string): CachedChapter;
    loadChapter?(bookId: string, chapter: number, tr: string): Promise<CachedChapter>;
  };
  CODEX_ENGAGEMENT?: { emit?(type: string, ref: string | null, weight: number, domain: string): void };
  CODEX_INTEL?: { intelEngine(): IntelEngine };
  CODEX_PLUGINS_API?: { register(plugin: CrossRefPlugin): unknown };
  codexGoto?: (bookId: string, chapter: number, verse: number) => void;
  codexJumpToRef?: (display: string) => void;
  // set by the panel (automation hooks, cleared on unmount)
  codexXrefCenter?: (ref: unknown) => string | null;
  codexXrefState?: () => XrefState;
  // set at module load (the frozen export contract)
  CODEX_CrossRefLookup?: CrossRefLookup;
  CODEX_CrossRefPanel?: React.ComponentType<CrossRefPanelProps>;
}

export function xw(): CrossRefWindow {
  return window as unknown as CrossRefWindow;
}
