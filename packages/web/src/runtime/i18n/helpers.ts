// i18n — pure functions/logic (no custom-window access; `document` is a
// standard global, not a custom one — see i18n-window.ts for the window-
// boundary rule). Faithfully ported from legacy/i18n.js.
import type { LangId, LangDict } from "./types.js";
import { T, T_DRIFT, RTL, CODEX_LANG_NAME_MAP } from "./data.js";

// ── lang validity / resolution ───────────────────────────────────────────────
// Legacy: `if (!T[lang]) return;` inside applyCodexLang, and `T[lang] || T.en`
// inside t(). Both boil down to "is this a known key of T".
export function isKnownLang(lang: string): lang is LangId {
  return Object.prototype.hasOwnProperty.call(T, lang);
}

function dictForLang(lang: string): LangDict {
  return isKnownLang(lang) ? T[lang] : T.en;
}

// ── core translation lookup — mirrors legacy t(key) minus the window reads ──
// Order preserved exactly:
//   1. drift overlay (only if drift is on AND T_DRIFT has this key)
//   2. active language dict (or English if lang unknown)
//   3. English fallback
//   4. the key itself (never breaks the UI)
export function translate(key: string, lang: string, drift: boolean): string {
  if (drift && Object.prototype.hasOwnProperty.call(T_DRIFT, key)) {
    // hasOwnProperty guarantees presence; cast is safe.
    return T_DRIFT[key] as string;
  }
  const dict = dictForLang(lang);
  if (Object.prototype.hasOwnProperty.call(dict, key)) return dict[key] as string;
  if (Object.prototype.hasOwnProperty.call(T.en, key)) return T.en[key] as string;
  return key;
}

// ── RTL / document side effects — mirrors legacy applyLangSideEffects(lang) ──
export function applyLangSideEffects(lang: string): void {
  document.documentElement.setAttribute("lang", lang);
  document.documentElement.setAttribute("dir", RTL.has(lang as LangId) ? "rtl" : "ltr");
}

// ── human-readable lang name — mirrors legacy window.codexLangName ──────────
// NOTE: preserved from legacy — the inline `map` in legacy is identical to
// CODEX_LANG_NAME_MAP (already extracted in data.ts), reused here instead of
// being redefined.
function langNameFor(key: string): string | undefined {
  return isKnownLang(key) ? CODEX_LANG_NAME_MAP[key] : undefined;
}

// NOTE: preserved from legacy — `id || currentLang || "en"` means an
// explicit-but-invalid `id` short-circuits the chain: it does NOT fall back
// to `currentLang` just because `id` is unknown to the map. It only falls
// back to `currentLang` when `id` itself is falsy (undefined/"").
export function resolveLangName(id: string | undefined, currentLang: string | undefined): string {
  const key = id || currentLang || "en";
  return langNameFor(key) ?? "English";
}
