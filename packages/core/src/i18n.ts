// UI translation registry (9 languages). Ported from i18n.js.
//
// The string tables are extracted faithfully into JSON; this module gives them
// types and a pure lookup. The original read/wrote window.CODEX_LANG and fired
// DOM side effects (lang/dir attributes, "codex:lang" events) — those are
// platform glue handled by the web wiring layer; core stays pure and stateless
// except for the optional createI18n() instance that holds the current language.

import langsJson from "./data/i18n-langs.json";
import stringsJson from "./data/i18n-strings.json";
import driftJson from "./data/i18n-drift.json";

export interface LangInfo {
  id: string;
  label: string;
  glyph: string;
}

export type StringTable = Record<string, string>;

export const langs = langsJson as unknown as LangInfo[];
const T = stringsJson as unknown as Record<string, StringTable>;
const T_DRIFT = driftJson as unknown as StringTable;
const RTL = new Set<string>(["he"]);

const LANG_NAMES: Record<string, string> = {
  en: "English",
  es: "Spanish",
  de: "German",
  pt: "Portuguese",
  fr: "French",
  la: "Latin",
  he: "Hebrew",
  el: "Greek",
  hi: "Hindi",
};

function has(o: StringTable, k: string): boolean {
  return Object.prototype.hasOwnProperty.call(o, k);
}

/** Human-readable language name (used to instruct the LLM which language to write). */
export function langName(id?: string): string {
  return LANG_NAMES[id || "en"] || "English";
}

export function isRtl(lang: string): boolean {
  return RTL.has(lang);
}

/**
 * Pure key lookup with the original fallback chain:
 * drift table (if enabled) → active language → English → the key itself.
 */
export function translate(key: string, lang: string, opts?: { drift?: boolean }): string {
  if (opts?.drift && has(T_DRIFT, key)) return T_DRIFT[key] as string;
  const en = T["en"] as StringTable;
  const dict = (T[lang] as StringTable | undefined) ?? en;
  if (has(dict, key)) return dict[key] as string;
  if (has(en, key)) return en[key] as string;
  return key;
}

export interface I18n {
  readonly lang: string;
  readonly drift: boolean;
  readonly langs: LangInfo[];
  t(key: string): string;
  setLang(lang: string): void;
  setDrift(on: boolean): void;
  langName(id?: string): string;
  isRtl(lang?: string): boolean;
}

/** A small stateful instance holding the active language + drift flag. */
export function createI18n(init?: { lang?: string; drift?: boolean }): I18n {
  let lang = init?.lang && T[init.lang] ? init.lang : "en";
  let drift = !!init?.drift;
  return {
    get lang() {
      return lang;
    },
    get drift() {
      return drift;
    },
    langs,
    t(key) {
      return translate(key, lang, { drift });
    },
    setLang(l) {
      if (T[l]) lang = l;
    },
    setDrift(on) {
      drift = !!on;
    },
    langName(id) {
      return langName(id || lang);
    },
    isRtl(l) {
      return isRtl(l ?? lang);
    },
  };
}
