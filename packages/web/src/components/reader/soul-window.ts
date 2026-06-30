// reader (soul) — typed window boundary (migrated from reader.jsx). The plugin
// reader is "a thin projection over the immortal engines" (law 5): it reads a
// handful of runtime globals lazily, at render/load time. Centralise the typing
// here; sub-modules call sw() and read what they need. Standard DOM globals
// (location, screen, open, matchMedia, document, localStorage) are the platform,
// not CODEX runtime globals, so they stay on the real Window type.
import type { DivineSeg, DivineRule } from "./divine.js";

export interface SoulTranslation {
  id: string;
  name?: string;
  year?: string | number;
  license?: string;
  canons?: string[];
}

export interface SoulBook {
  id: string;
  name?: string;
  chapters?: number;
  testament?: string;
  canon?: string;
}

// A verse row carries .n, per-translation text under the translation id, the
// red-letter map and the Jesus-verse flag. Index signature mirrors the runtime
// shape (text keyed by translation id).
export interface SoulVerse {
  n: number;
  _jesusVerse?: boolean;
  red?: Record<string, unknown>;
  [translationId: string]: unknown;
}

export interface GlossEntry {
  ref?: string;
  heading?: string;
  title?: string;
  body?: string;
  author?: string;
  from?: string;
  sigil?: string;
  tag?: string;
}

export interface PanelData {
  title?: string;
  subtitle?: string;
  gnosis?: GlossEntry[];
  talmud?: GlossEntry[];
  commentary?: GlossEntry[];
}

export interface PanelEvent {
  type: string;
  bookId?: string;
  chapter?: number | string;
  data?: PanelData;
}

export interface PanelsApi {
  getCached?(bookId: string, chapter: number): PanelData | null;
  subscribe?(fn: (ev: PanelEvent) => void): () => void;
  load?(bookId: string, chapter: number, bookName: string, opts: { provider?: string; model?: string }): Promise<PanelData>;
}

export interface BibleApi {
  loadMulti(bookId: string, chapter: number, translations: string[]): Promise<SoulVerse[] | null | undefined>;
}

export interface SoulTweaks {
  primaryTranslation?: string;
  redLetter?: boolean;
  fontScale?: number;
  provider?: string;
  model?: string;
  overlayGnosis?: boolean;
  overlayTalmud?: boolean;
  overlayCommentary?: boolean;
  divineGold?: boolean;
  divineHebrew?: boolean;
  [k: string]: unknown;
}

export interface SoulCodexData {
  translations?: SoulTranslation[];
  books?: SoulBook[];
  tweaks?: SoulTweaks;
  seedPanels?: Record<string, PanelData | undefined>;
}

export interface NowPos {
  bookId?: string;
  book?: string;
  chapter?: number;
  verse?: number;
  ref?: string;
}

export interface DivineEngine {
  segment: (text: string | null | undefined) => DivineSeg[];
  rules: DivineRule[];
}

export interface SoulPluginsApi {
  register(plugin: unknown): unknown;
}

export interface SoulWindow {
  CODEX_DATA?: SoulCodexData;
  BIBLE?: BibleApi;
  CODEX_NOW?: NowPos;
  CODEX_PANELS?: PanelsApi;
  CODEX_DIVINE?: DivineEngine;
  CODEX_PLUGINS_API?: SoulPluginsApi;
  __CODEX_READY__?: boolean;
  t?: (k: string) => string;
  codexJumpToRef?: (ref: string) => void;
  codexSelectVerse?: (n: number) => void;
  codexOpenVerseMenu?: (n: number, rect: DOMRect, ctx?: unknown) => void;
  codexGoto?: (bookId: string, ch: number, v: number) => void;
  codexNewReader?: () => void;
  codexDisplays?: { open(surface: string): void };
  codexDesk?: { open(panel: string): void };
  codexSetPrimary?: (tr: string) => void;
  codexOpenPanel?: (id: string) => void;
  CodexReaderX?: unknown;
  CxrSpawn?: unknown;
}

export function sw(): SoulWindow {
  return window as unknown as SoulWindow;
}
