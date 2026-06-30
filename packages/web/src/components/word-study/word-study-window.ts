// word-study — typed window boundary (migrated from word-study.jsx). Word Study
// reads runtime globals: books data, AI tweaks, the Strong's lookup function, the
// search engine, the plugins API, and the navigation door. No window globals are
// SET by this module — the only export contract is the plugin registered via
// window.CODEX_PLUGINS_API.register() in index.tsx. Standard browser globals
// (localStorage, fetch, CustomEvent, dispatchEvent) keep their lib.dom typings
// and are used directly.

export interface WsBook {
  id: string;
  name: string;
}

export interface WsTweaks {
  provider?: string;
  model?: string;
}

export interface WsCodexData {
  books?: WsBook[];
  tweaks?: WsTweaks;
}

export interface WsSearchResult {
  ref?: string;
  id?: string;
  snippet?: string;
  text?: string;
}

export type WsSearchOutput = WsSearchResult[] | { results?: WsSearchResult[] };

export interface WsSearchApi {
  search(query: string, opts?: { limit?: number }): WsSearchOutput | Promise<WsSearchOutput>;
}

export interface WsStrongsEntry {
  word?: string;
  translit?: string;
  gloss?: string;
  def?: string;
  usage?: number;
}

export interface WsPluginPanel {
  id: string;
  label: string;
  glyph: string;
  render(ctx: unknown): unknown;
}

export interface WsVerseAction {
  label: string;
  icon: string;
  handler(ctx: unknown): void;
}

export interface WsPlugin {
  id: string;
  name: string;
  version: string;
  panels: WsPluginPanel[];
  verseActions: WsVerseAction[];
}

export interface WsPluginsApi {
  register(plugin: WsPlugin): unknown;
}

export interface WordStudyWindow {
  CODEX_DATA?: WsCodexData;
  CODEX_SEARCH?: WsSearchApi;
  CODEX_StrongsLookup?: (strongs: string) => WsStrongsEntry | null | undefined;
  CODEX_PLUGINS_API?: WsPluginsApi;
  codexJumpToRef?: (ref: string) => void;
}

export function wsw(): WordStudyWindow {
  return window as unknown as WordStudyWindow;
}
