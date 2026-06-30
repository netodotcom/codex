// builder — typed window boundary (migrated from builder.jsx). The Sermon/Study
// Builder reads a few runtime globals (book data for ref formatting, the cached
// Bible chapters for verse text, the engagement engine for depth-actions, and
// the plugins API for self-registration). Centralise the typing here; callers
// use bw() and read what they need, lazily, at call time. Standard DOM globals
// (window/document/localStorage/navigator/location) are used directly.
import type React from "react";

export interface CodexBook {
  id?: string;
  name?: string;
}
export interface CodexData {
  books?: CodexBook[];
}

// A cached chapter verse: { n, text } plus a per-translation text field keyed by
// the translation id (vv[translation]); hence the index signature.
export interface BibleVerse {
  n?: number;
  text?: string;
  [k: string]: unknown;
}
export interface BibleChapter {
  verses?: BibleVerse[];
}
export interface BibleApi {
  getCachedChapter?: (bookId: string | undefined, chapter: number | undefined, translation: string) => BibleChapter | null | undefined;
}

export interface EngagementApi {
  DEPTH_ACTIONS?: Record<string, unknown>;
}

export interface PluginPanel {
  id: string;
  label: string;
  glyph: string;
  render: (ctx: Record<string, unknown> | undefined) => React.ReactElement;
}
export interface VerseAction {
  label: string;
  icon: string;
  handler: (verseRef: unknown) => void;
}
export interface PluginSpec {
  id: string;
  name: string;
  version: string;
  panels: PluginPanel[];
  verseActions?: VerseAction[];
}
export interface PluginsApi {
  register?: (plugin: PluginSpec) => unknown;
}

export interface BuilderWindow {
  CODEX_DATA?: CodexData;
  BIBLE?: BibleApi;
  CODEX_ENGAGEMENT?: EngagementApi;
  CODEX_PLUGINS_API?: PluginsApi;
}

export function bw(): BuilderWindow {
  return window as unknown as BuilderWindow;
}
