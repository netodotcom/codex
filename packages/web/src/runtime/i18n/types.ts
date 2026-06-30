// i18n — shared TypeScript types.
// Migrated from legacy/i18n.js — shapes are the contract the parity probe
// checks (typeof window.t === "function").

export type LangId = "en" | "es" | "de" | "pt" | "fr" | "la" | "he" | "el" | "hi";

export interface LangEntry {
  id: LangId;
  label: string;
  glyph: string;
}

export type LangDict = Record<string, string>;

export type TranslationTable = Record<LangId, LangDict>;
