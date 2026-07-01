// i18n — typed window boundary. All runtime global accesses go through
// iw() so the rest of the code never touches `window as any`.
// Mirrors the pattern established in gematria-window.ts / modules-window.ts.
import type { LangEntry, LangDict, TranslationTable } from "./types.js";

// ── Window globals this module SETS ──────────────────────────────────────────
// ── Window globals this module READS ─────────────────────────────────────────
//   (CODEX_LANG / CODEX_DRIFT are both set AND read back by this module —
//   CODEX_LANG is also written directly by App from the persisted tweak, per
//   the legacy header comment, so it stays a plain `string`, not `LangId`.)
export interface I18nWindow {
  CODEX_LANG?: string;
  CODEX_LANGS?: readonly LangEntry[];
  CODEX_T?: TranslationTable;
  CODEX_T_DRIFT?: LangDict;
  CODEX_DRIFT?: boolean;
  t?: (key: string) => string;
  applyCodexLang?: (lang: string) => void;
  codexLangName?: (id?: string) => string;
  applyCodexDrift?: (on: boolean) => void;
}

export function iw(): I18nWindow {
  return window as unknown as I18nWindow;
}
