// Gematria — pure computation functions (no DOM/window access).
// Faithfully ported from legacy/gematria.js. All quirks, edge-cases and
// special-case handling are preserved exactly (comments mark non-obvious ones).
import type { Lang, AllResult, AtbashResult, AlbamResult } from "./types.js";
import {
  HEBREW_BASE, HEBREW_FINALS500, HEBREW_ORDINAL, HEBREW_NAMES, HEBREW_ORDER,
  GREEK_BASE, GREEK_ORDINAL,
} from "./data.js";

// ── normalization ─────────────────────────────────────────────────────────────
export function strip(s: string): string {
  return (s || "").normalize("NFD").replace(/\p{M}/gu, "");
}
// Internal helper: NFD-strip then lowercase. Used by every letter iteration so
// pointed Hebrew ("אַ֫הֲבָ֖ה") and accented Greek ("λόγος") transparently reduce.
function lower(s: string): string { return strip(s).toLowerCase(); }

// ── language detection ────────────────────────────────────────────────────────
export function isHebrew(s: string): boolean { return /[֐-׿]/.test(s); }
export function isGreek(s: string): boolean  { return /[Ͱ-Ͽἀ-῿]/.test(s); }
export function detectLang(s: string): Lang {
  if (!s) return "english";
  if (isHebrew(s)) return "hebrew";
  if (isGreek(s)) return "greek";
  return "english";
}

// ── utilities ─────────────────────────────────────────────────────────────────
export function reduceToDigit(n: number): number {
  n = Math.abs(n | 0);
  while (n > 9) n = String(n).split("").reduce((s, d) => s + +d, 0);
  return n;
}
export function triangular(n: number): number { return (n * (n + 1)) / 2; }

// ── HEBREW SYSTEMS ────────────────────────────────────────────────────────────
function _hebSum(s: string, table: Record<string, number>): number {
  let n = 0;
  for (const ch of lower(s)) {
    const v = table[ch];
    if (v) n += v;
  }
  return n;
}
export function mispar_hechrachi(s: string): number { return _hebSum(s, HEBREW_BASE); }
export function mispar_gadol(s: string): number     { return _hebSum(s, { ...HEBREW_BASE, ...HEBREW_FINALS500 }); }
export function mispar_sidduri(s: string): number   { return _hebSum(s, HEBREW_ORDINAL); }

export function mispar_katan(s: string): number {
  // each letter reduced to a single digit, then summed
  let n = 0;
  for (const ch of lower(s)) {
    const v = HEBREW_BASE[ch];
    if (v) n += reduceToDigit(v);
  }
  return n;
}

export function mispar_katan_mispari(s: string): number {
  // total sum then reduce to a single digit
  return reduceToDigit(mispar_hechrachi(s));
}

export function mispar_boneh(s: string): number {
  // "building" — cumulative sum: a + (a+b) + (a+b+c) ...
  let running = 0, total = 0;
  for (const ch of lower(s)) {
    const v = HEBREW_BASE[ch];
    if (v) { running += v; total += running; }
  }
  return total;
}

// Triangular value of each letter ("Mispar Kidmi" sometimes called).
// NOTE: preserved from legacy — common definition is triangular(v), not a
// subset sum over alphabet values.
export function mispar_kidmi(s: string): number {
  let n = 0;
  for (const ch of lower(s)) {
    const v = HEBREW_BASE[ch];
    if (v) n += triangular(v);
  }
  return n;
}

// Atbash: א↔ת, ב↔ש, ... swap from each end of the 22-letter alphabet.
// NOTE: preserved from legacy — finals are first mapped to their base letter,
// then swapped. The HEBREW_NAMES guard rejects letters that have a spelled-out
// name but are not in the 22-letter HEBREW_ORDER (none exist, but kept verbatim).
export function atbash(s: string): AtbashResult {
  const ABC = HEBREW_ORDER;
  let out = "";
  for (const ch of lower(s)) {
    const i = ABC.indexOf(ch);
    if (i >= 0) {
      const mapped = ABC[ABC.length - 1 - i];
      if (mapped !== undefined) out += mapped;
    } else if (HEBREW_NAMES[ch] === undefined && /[֐-׿]/.test(ch)) {
      // finals: map to base then swap
      const base =
        ch === "ך" ? "כ" : ch === "ם" ? "מ" : ch === "ן" ? "נ" :
        ch === "ף" ? "פ" : ch === "ץ" ? "צ" : "";
      if (base) {
        const j = ABC.indexOf(base);
        if (j >= 0) {
          const mapped = ABC[ABC.length - 1 - j];
          if (mapped !== undefined) out += mapped;
        }
      }
    }
  }
  return { transformed: out, value: mispar_hechrachi(out) };
}

// Albam: split alphabet in half, swap halves (א↔ל, ב↔מ, ...).
export function albam(s: string): AlbamResult {
  const ABC = HEBREW_ORDER, H = 11;
  let out = "";
  for (const ch of lower(s)) {
    const i = ABC.indexOf(ch);
    if (i >= 0) {
      const mapped = ABC[(i + H) % 22];
      if (mapped !== undefined) out += mapped;
    }
  }
  return { transformed: out, value: mispar_hechrachi(out) };
}

// Mispar Ne'elam ("hidden") — value of the spelled-out name MINUS the letter itself.
export function mispar_neelam(s: string): number {
  let n = 0;
  for (const ch of lower(s)) {
    const name = HEBREW_NAMES[ch];
    if (!name) continue;
    n += mispar_hechrachi(name) - (HEBREW_BASE[ch] ?? 0);
  }
  return n;
}

// Mispar Ha'akhor ("back") — letter at position i (1-indexed) contributes value * i.
// NOTE: preserved from legacy — common definition multiplies each letter's value by
// its 1-based position, not the "22*position" variant.
export function mispar_haakhor(s: string): number {
  let n = 0, i = 1;
  for (const ch of lower(s)) {
    const v = HEBREW_BASE[ch];
    if (v) { n += v * i; i++; }
  }
  return n;
}

// ── GREEK SYSTEMS ─────────────────────────────────────────────────────────────
export function isopsephy_standard(s: string): number {
  let n = 0;
  for (const ch of lower(s)) {
    const v = GREEK_BASE[ch];
    if (v) n += v;
  }
  return n;
}

export function isopsephy_ordinal(s: string): number {
  let n = 0;
  for (const ch of lower(s)) {
    const v = GREEK_ORDINAL[ch];
    if (v) n += v;
  }
  return n;
}

export function isopsephy_reduced(s: string): number { return reduceToDigit(isopsephy_standard(s)); }

// ── ENGLISH SYSTEMS ───────────────────────────────────────────────────────────
// NOTE: preserved from legacy — English functions do NOT go through lower()/strip();
// they use plain .toLowerCase() so only ASCII a-z chars contribute.
export function english_ordinal(s: string): number {
  let n = 0;
  for (const ch of (s || "").toLowerCase()) {
    const c = ch.charCodeAt(0);
    if (c >= 97 && c <= 122) n += c - 96;
  }
  return n;
}

export function english_reduction(s: string): number {
  let n = 0;
  for (const ch of (s || "").toLowerCase()) {
    const c = ch.charCodeAt(0);
    if (c >= 97 && c <= 122) {
      const ord = c - 96;
      n += ((ord - 1) % 9) + 1;
    }
  }
  return n;
}

export function english_reverse(s: string): number {
  let n = 0;
  for (const ch of (s || "").toLowerCase()) {
    const c = ch.charCodeAt(0);
    if (c >= 97 && c <= 122) n += 27 - (c - 96);
  }
  return n;
}

// ── BUNDLE: compute all applicable systems ────────────────────────────────────
export function all(text: string, lang?: Lang): AllResult {
  const L = lang ?? detectLang(text);
  if (L === "hebrew") {
    return {
      lang: "hebrew",
      hechrachi: mispar_hechrachi(text),
      gadol:     mispar_gadol(text),
      sidduri:   mispar_sidduri(text),
      katan:     mispar_katan(text),
      katan_mispari: mispar_katan_mispari(text),
      boneh:     mispar_boneh(text),
      kidmi:     mispar_kidmi(text),
      atbash:    atbash(text),
      albam:     albam(text),
      neelam:    mispar_neelam(text),
      haakhor:   mispar_haakhor(text),
    };
  }
  if (L === "greek") {
    return {
      lang:      "greek",
      isopsephy: isopsephy_standard(text),
      ordinal:   isopsephy_ordinal(text),
      reduced:   isopsephy_reduced(text),
    };
  }
  return {
    lang:      "english",
    ordinal:   english_ordinal(text),
    reduction: english_reduction(text),
    reverse:   english_reverse(text),
  };
}
