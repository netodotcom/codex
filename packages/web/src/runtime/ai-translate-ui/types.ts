// ai-translate-ui — shared TypeScript types.

/** Per-language translation table: { [key]: translated } */
export type LangDict = Record<string, string>;

/** Full i18n table: { [lang]: LangDict } */
export type I18nTable = Record<string, LangDict>;

/** Entry in the DOM-walker in-memory queue. */
export interface DomQueueEntry {
  text: string;
  nodes: Text[];
}

/** Tracks the in-flight batch so concurrent callers share the same promise. */
export interface InflightTranslation {
  lang: string;
  p: Promise<void>;
}

/** Public API surface assigned to window.CODEX_aiTranslateUI. */
export interface CodexAiTranslateUiApi {
  translateMissing(lang: string): Promise<void>;
  hydrate(lang: string): void;
  hasAIKey(): boolean;
  clearCache(lang: string): void;
  sweepDom(): void;
}
