// Gematria — shared TypeScript types.
// Migrated from legacy/gematria.js — shapes are the contract the parity probe
// checks (typeof CODEX_GEMATRIA === "object", typeof CODEX_GEMATRIA_INDEX === "object").

export type Lang = "hebrew" | "greek" | "english";

export interface AtbashResult {
  transformed: string;
  value: number;
}

export interface AlbamResult {
  transformed: string;
  value: number;
}

export interface HebrewAll {
  lang: "hebrew";
  hechrachi: number;
  gadol: number;
  sidduri: number;
  katan: number;
  katan_mispari: number;
  boneh: number;
  kidmi: number;
  atbash: AtbashResult;
  albam: AlbamResult;
  neelam: number;
  haakhor: number;
}

export interface GreekAll {
  lang: "greek";
  isopsephy: number;
  ordinal: number;
  reduced: number;
}

export interface EnglishAll {
  lang: "english";
  ordinal: number;
  reduction: number;
  reverse: number;
}

export type AllResult = HebrewAll | GreekAll | EnglishAll;

// Index types
export interface IndexMatch {
  ref: string;
  word: string;
  system: string;
}

// Keys are numeric gematria values stored as strings (JSON serialisation collapses
// number keys to strings; using string keys keeps the type consistent).
export type IndexRecord = Record<string, IndexMatch[]>;

export interface IndexStats {
  values: number;
  matches: number;
  builtAt: number;
}
