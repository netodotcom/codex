// ai-translate-ui — typed window boundary.
// All runtime global accesses go through aw() so the rest of the code never
// touches `window as any`. Mirrors the pattern in gematria-window.ts / modules-window.ts.
import type { CodexAiTranslateUiApi, I18nTable } from "./types.js";

// ── Window globals this module READS ────────────────────────────────────────
//   CODEX_LANG          — current language code (set by i18n.js, not migrated)
//   CODEX_T             — live i18n table: { [lang]: { [key]: translated } }
//   applyCodexLang      — i18n.js function this module wraps
//   __cxToastListener   — truthy if a toast listener has been registered globally

// ── Window globals this module SETS ─────────────────────────────────────────
//   CODEX_aiTranslateUI    — public debug / plugin API
//   CODEX_registerStrings  — plugin string registration hook
//   __cxDomWalkerInstalled — install-once guard for the MutationObserver walker
//   applyCodexLang         — WRAPPED (re-assigned over i18n.js' original)

export interface AiTranslateUiWindow {
  // Globals SET by this module
  CODEX_aiTranslateUI?: CodexAiTranslateUiApi;
  CODEX_registerStrings?: (obj: unknown) => void;
  __cxDomWalkerInstalled?: boolean;
  applyCodexLang?: (lang: string) => void;
  // Globals READ from i18n.js (not migrated)
  CODEX_LANG?: string;
  CODEX_T?: I18nTable;
  __cxToastListener?: boolean;
}

export function aw(): AiTranslateUiWindow {
  return window as unknown as AiTranslateUiWindow;
}
