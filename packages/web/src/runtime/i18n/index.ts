// i18n — entry point. Replaces legacy/i18n.js.
// Reproduces the exact load-time side effects of the legacy IIFE, in the
// same order: CODEX_LANG, CODEX_LANGS, CODEX_T, CODEX_T_DRIFT, CODEX_DRIFT,
// t, applyCodexLang, codexLangName, applyCodexDrift.
import { LANGS, T, T_DRIFT } from "./data.js";
import { translate, isKnownLang, applyLangSideEffects, resolveLangName } from "./helpers.js";
import { iw } from "./i18n-window.js";

function t(key: string): string {
  const w = iw();
  return translate(key, w.CODEX_LANG || "en", !!w.CODEX_DRIFT);
}

function applyCodexLang(lang: string): void {
  if (!isKnownLang(lang)) return;
  iw().CODEX_LANG = lang;
  applyLangSideEffects(lang);
  // Notify subtrees that resolve t() lazily (Oracle, panels) so they
  // re-render or re-fetch in the new language.
  try {
    window.dispatchEvent(new CustomEvent("codex:lang", { detail: { lang } }));
  } catch { /* ignore */ }
}

function codexLangName(id?: string): string {
  return resolveLangName(id, iw().CODEX_LANG);
}

function applyCodexDrift(on: boolean): void {
  iw().CODEX_DRIFT = !!on;
  // NOTE: preserved from legacy — unlike applyCodexLang's dispatch, this one
  // is NOT wrapped in try/catch.
  window.dispatchEvent(new CustomEvent("codex:lang", { detail: { drift: !!on } }));
}

// ── Load-time side effects — same order as the legacy IIFE ──────────────────
iw().CODEX_LANG = "en";
iw().CODEX_LANGS = LANGS;
iw().CODEX_T = T;
iw().CODEX_T_DRIFT = T_DRIFT;
iw().CODEX_DRIFT = false;
iw().t = t;
iw().applyCodexLang = applyCodexLang;
iw().codexLangName = codexLangName;
iw().applyCodexDrift = applyCodexDrift;
