// dictionary — typed window boundary (migrated from dictionary.jsx).
// Reads:  CODEX_MODULES (loadModule), CODEX_DATA (books),
//         BIBLE (getCachedChapter), codexJumpToRef, CODEX_PLUGINS_API (register).
// Sets:   CODEX_DictionaryPanel.
// Standard browser globals (CustomEvent, dispatchEvent) keep their lib.dom typings.

export interface DictBook {
  id: string;
  name: string;
}

export interface DictModulesApi {
  loadModule(id: string): Promise<unknown>;
}

export interface DictBibleApi {
  getCachedChapter?(bookId: string, chapter: number, translation: string): unknown;
}

export interface DictData {
  books?: DictBook[];
}

export interface DictPluginsApi {
  register(plugin: unknown): unknown;
}

export interface DictionaryWindow {
  CODEX_MODULES?: DictModulesApi;
  CODEX_DATA?: DictData;
  BIBLE?: DictBibleApi;
  codexJumpToRef?: (display: string) => void;
  CODEX_PLUGINS_API?: DictPluginsApi;
  CODEX_DictionaryPanel?: unknown;
}

export function dw(): DictionaryWindow {
  return window as unknown as DictionaryWindow;
}
