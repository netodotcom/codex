// Gematria cross-reference index — pure build/query over cached verses.
//
// Ported from the index half of gematria.js (window.CODEX_GEMATRIA_INDEX). The
// original read verses from IndexedDB and persisted the index to localStorage;
// here build is a pure function over a chapter map, so the platform layer only
// has to supply the chapters and persist the result.

import { detectLang, hebrew, greek, english } from "./gematria.js";

export interface IndexMatch {
  ref: string;
  word: string;
  system: string;
}

export type GematriaIndex = Record<number, IndexMatch[]>;

/** Chapter map: key "<bookId>.<chapter>.<translation>" → verse texts (1-indexed). */
export type ChapterMap = Record<string, Array<string | { text?: string }>>;

const MAX_PER_VALUE = 50;

// words split on whitespace / punctuation; Hebrew niqqud + cantillation stripped.
export function tokenize(verseText: string): string[] {
  return (verseText || "")
    .replace(/[֑-ֽֿׁ-ׇ׳״]/g, "")
    .split(/[\s.,;:!?·"׳״«»()[\]{}‐\-—]+/)
    .filter((w) => w && w.length >= 2);
}

function pushMatch(index: GematriaIndex, value: number, system: string, ref: string, word: string): void {
  if (!value || value < 2) return; // skip 0/1 noise
  const bucket = index[value] ?? (index[value] = []);
  if (bucket.length >= MAX_PER_VALUE) return;
  for (const m of bucket) if (m.ref === ref && m.word === word && m.system === system) return;
  bucket.push({ ref, word, system });
}

export function buildGematriaIndex(chapters: ChapterMap): GematriaIndex {
  const index: GematriaIndex = {};
  for (const key of Object.keys(chapters)) {
    const parts = key.split(".");
    if (parts.length < 3) continue;
    const bookId = parts[0];
    const chapter = parts[1];
    const verses = chapters[key];
    if (!Array.isArray(verses)) continue;
    for (let i = 0; i < verses.length; i++) {
      const entry = verses[i];
      const text = typeof entry === "string" ? entry : entry?.text || "";
      const ref = `${bookId}.${chapter}.${i + 1}`;
      for (const tok of tokenize(text)) {
        const lang = detectLang(tok);
        if (lang === "hebrew") {
          pushMatch(index, hebrew.hechrachi(tok), "hechrachi", ref, tok);
        } else if (lang === "greek") {
          pushMatch(index, greek.isopsephy(tok), "isopsephy", ref, tok);
        } else {
          if (tok.length < 4) continue; // avoid 'the', 'a' noise
          pushMatch(index, english.ordinal(tok), "en_ordinal", ref, tok);
        }
      }
    }
  }
  return index;
}

export function findInIndex(index: GematriaIndex, value: number, opts?: { system?: string }): IndexMatch[] {
  const arr = index[value] ?? [];
  return opts?.system ? arr.filter((m) => m.system === opts.system) : arr.slice();
}

export function indexStats(index: GematriaIndex): { values: number; matches: number } {
  let matches = 0;
  for (const k of Object.keys(index)) matches += (index[Number(k)] ?? []).length;
  return { values: Object.keys(index).length, matches };
}
