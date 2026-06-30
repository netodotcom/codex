// help — static metadata + language/category helpers (migrated verbatim from
// help.jsx). Pure logic; the only runtime reads (CODEX_LANGS / CODEX_LANG) go
// through help-window.ts. SUPPORTED_LANGS is captured at module load, exactly as
// the legacy IIFE did.
import { hw } from "./help-window.js";

// ── Article shapes (from data/help/articles.json) ──────────────────────────
export interface Article {
  id: string;
  title?: string;
  category: string;
  tags?: string[];
  body?: string;
  lastUpdated?: string;
}
export interface ArticlesDoc {
  version?: string;
  updated?: string;
  categories?: string[];
  articles?: Article[];
}

export interface SupportedLang {
  code: string;
  label: string;
}
export interface CategoryMeta {
  icon: string;
  blurb: string;
}

// ── Supported translation targets ─────────────────────────────────────────
export function getSupportedLangs(): SupportedLang[] {
  const fallback: SupportedLang[] = [
    { code: "es", label: "Español" },
    { code: "de", label: "Deutsch" },
    { code: "pt", label: "Português" },
    { code: "fr", label: "Français" },
    { code: "la", label: "Latina" },
    { code: "he", label: "עברית" },
    { code: "el", label: "Ἑλληνική" },
    { code: "hi", label: "हिन्दी" },
  ];
  const src = (typeof window !== "undefined" && Array.isArray(hw().CODEX_LANGS))
    ? hw().CODEX_LANGS : null;
  if (!src) return fallback;
  return src
    .filter((l) => l && l.id && l.id !== "en")
    .map((l) => ({ code: String(l.id), label: l.label || String(l.id) }));
}
export const SUPPORTED_LANGS: SupportedLang[] = getSupportedLangs();

export const LANG_NAME: Record<string, string> = {
  es: "Spanish", de: "German", pt: "Portuguese", fr: "French",
  la: "Latin",   he: "Hebrew", el: "Greek",      hi: "Hindi",
};

// Category metadata — icon + 1-line description. Falls back gracefully
// if articles.json adds a category we don't yet have art for.
export const CATEGORY_META: Record<string, CategoryMeta> = {
  "Basics":            { icon: "🜨", blurb: "Get oriented. The shortest path to reading scripture in CODEX." },
  "Reading":           { icon: "📜", blurb: "Typography, themes, translations, side-by-side, distraction-free." },
  "Study Tools":       { icon: "⌖", blurb: "Verse menu, maps, art, mirrors, marks, notes, cross-refs, quests." },
  "AI Features":       { icon: "✦", blurb: "Oracle, panels, reels — AI as a humble study companion." },
  "Power User":        { icon: "⌘", blurb: "Offline, shortcuts, sync, custom repos, terminal CLI." },
  "Audience-Specific": { icon: "◊", blurb: "Setups tuned for Jewish readers, academics, and more." },
  "About":             { icon: "ℵ", blurb: "Vision, privacy, troubleshooting. The story behind CODEX." },
  "Developer":         { icon: "⚙", blurb: "Plugins, data modules, the extension surface." },
};
export const catMeta = (c: string): CategoryMeta => CATEGORY_META[c] || { icon: "✧", blurb: "" };

export function currentUiLang(): string {
  try {
    const cl = (typeof window !== "undefined") ? hw().CODEX_LANG : undefined;
    if (cl) return cl;
    const ls = localStorage.getItem("codex.lang");
    if (ls) return ls;
  } catch {
    /* ignore — fall through to "en" */
  }
  return "en";
}
