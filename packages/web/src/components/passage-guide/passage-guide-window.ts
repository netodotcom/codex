// passage-guide — typed window boundary (migrated from passage-guide.jsx). The
// guide reads a handful of runtime globals (i18n/lang, the kabbalah cache, the
// cross-ref / gematria / strongs engines, the modules loader, BIBLE, the reader
// navigation door, the plugin API). Centralise the typing here; every module
// calls pgw() and reads what it needs, lazily, at render/run time.
import type React from "react";
import type { Guide } from "./json.js";

// Kabbalah numerology mapping (data/modules/kabbalah-mappings.json).
export interface KabConcept {
  concept?: string;
  [k: string]: unknown;
}
export interface KabMap {
  value_to_concept?: Record<string, KabConcept>;
  [k: string]: unknown;
}

// TSK cross-reference entry (after we tag it with the source verse).
export interface CrossRef {
  ref: string;
  theme?: string;
  word?: string;
  from?: number;
  [k: string]: unknown;
}
export interface CrossRefLookup {
  getCrossRefs(key: string): Promise<CrossRef[]>;
  formatRef?(key: string): string;
}

// Gematria index match (shape used by the snapshot).
export interface GematriaMatch {
  ref?: string;
  word?: string;
  system?: string;
  [k: string]: unknown;
}
export interface GematriaIndex {
  ensure?(): Promise<void> | void;
  find(value: number): GematriaMatch[];
}

export interface CodexModules {
  loadModule?(id: string): Promise<unknown>;
}

export interface BibleApi {
  getCachedChapter?(bookId: string | undefined, chapter: number | undefined, translation: string): { verses?: unknown[] } | null;
}

export interface StrongsEntry {
  gloss?: string;
  definition?: string;
  [k: string]: unknown;
}
export type StrongsLookup = (strongsId: string) => StrongsEntry | null;

export interface PluginPanel {
  id: string;
  label: string;
  glyph: string;
  render(ctx: unknown): React.ReactElement;
}
export interface PluginsApi {
  register(plugin: { id: string; name: string; version: string; panels: PluginPanel[] }): unknown;
}

export interface PassageGuideWindow {
  CODEX_LANG?: string;
  codexLangName?: () => string;
  __CODEX_KAB__?: KabMap | null;
  CODEX_CrossRefLookup?: CrossRefLookup;
  CODEX_GEMATRIA_INDEX?: GematriaIndex;
  CODEX_MODULES?: CodexModules;
  BIBLE?: BibleApi;
  CODEX_StrongsLookup?: StrongsLookup;
  codexJumpToRef?: (display: string) => void;
  CODEX_PLUGINS_API?: PluginsApi;
  // The component itself, re-exposed for reuse (engines outlive skins). Stored
  // as a loose value at the boundary; the renderer casts it back when used.
  CODEX_PassageGuide?: unknown;
}

export function pgw(): PassageGuideWindow {
  return window as unknown as PassageGuideWindow;
}

// Re-export the Guide shape for convenience at the boundary.
export type { Guide };
