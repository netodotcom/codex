// Gematria compute library — pure Hebrew/Greek/English numerology.
//
// Ported faithfully from the pure half of gematria.js (window.CODEX_GEMATRIA).
// The cross-reference INDEX half (IndexedDB/localStorage/events) is platform-
// coupled and lands in a later slice with its IO isolated. Values are locked
// by gematria.test.ts against ground truth from the original.
//
// All Hebrew/Greek input is normalized (NFD + strip combining marks), so
// "λόγος" → 373 and pointed "אַהֲבָה" → 13.

export type GematriaLang = "hebrew" | "greek" | "english";

export interface Transform {
  transformed: string;
  value: number;
}

export interface HebrewResult {
  lang: "hebrew";
  hechrachi: number;
  gadol: number;
  sidduri: number;
  katan: number;
  katan_mispari: number;
  boneh: number;
  kidmi: number;
  atbash: Transform;
  albam: Transform;
  neelam: number;
  haakhor: number;
}

export interface GreekResult {
  lang: "greek";
  isopsephy: number;
  ordinal: number;
  reduced: number;
}

export interface EnglishResult {
  lang: "english";
  ordinal: number;
  reduction: number;
  reverse: number;
}

export type GematriaResult = HebrewResult | GreekResult | EnglishResult;

type Table = Record<string, number>;

// ── normalization ──────────────────────────────────────────────────────
export function strip(s: string): string {
  return (s || "").normalize("NFD").replace(/\p{M}/gu, "");
}
function lower(s: string): string {
  return strip(s).toLowerCase();
}

// ── alphabets / tables ─────────────────────────────────────────────────
const HEBREW_BASE: Table = {
  א: 1, ב: 2, ג: 3, ד: 4, ה: 5, ו: 6, ז: 7, ח: 8, ט: 9,
  י: 10, כ: 20, ל: 30, מ: 40, נ: 50, ס: 60, ע: 70, פ: 80, צ: 90,
  ק: 100, ר: 200, ש: 300, ת: 400,
  ך: 20, ם: 40, ן: 50, ף: 80, ץ: 90,
};
const HEBREW_FINALS500: Table = { ך: 500, ם: 600, ן: 700, ף: 800, ץ: 900 };
const HEBREW_ORDER = "אבגדהוזחטיכלמנסעפצקרשת";
const HEBREW_ORDINAL: Table = (() => {
  const o: Table = {};
  [...HEBREW_ORDER].forEach((c, i) => {
    o[c] = i + 1;
  });
  o["ך"] = o["כ"]!;
  o["ם"] = o["מ"]!;
  o["ן"] = o["נ"]!;
  o["ף"] = o["פ"]!;
  o["ץ"] = o["צ"]!;
  return o;
})();
const HEBREW_NAMES: Record<string, string> = {
  א: "אלף", ב: "בית", ג: "גימל", ד: "דלת", ה: "הא",
  ו: "וו", ז: "זין", ח: "חית", ט: "טית", י: "יוד",
  כ: "כף", ל: "למד", מ: "מם", נ: "נון", ס: "סמך",
  ע: "עין", פ: "פא", צ: "צדי", ק: "קוף", ר: "ריש",
  ש: "שין", ת: "תיו",
};

const GREEK_BASE: Table = {
  α: 1, β: 2, γ: 3, δ: 4, ε: 5, ϛ: 6, ζ: 7, η: 8, θ: 9,
  ι: 10, κ: 20, λ: 30, μ: 40, ν: 50, ξ: 60, ο: 70, π: 80, ϟ: 90,
  ρ: 100, σ: 200, ς: 200, τ: 300, υ: 400, φ: 500, χ: 600, ψ: 700, ω: 800, ϡ: 900,
};
const GREEK_ORDER = "αβγδεζηθικλμνξοπρστυφχψω";
const GREEK_ORDINAL: Table = (() => {
  const o: Table = {};
  [...GREEK_ORDER].forEach((c, i) => {
    o[c] = i + 1;
  });
  o["ς"] = o["σ"]!;
  return o;
})();

// ── helpers ────────────────────────────────────────────────────────────
function isHebrew(s: string): boolean {
  return /[֐-׿]/.test(s);
}
function isGreek(s: string): boolean {
  return /[Ͱ-Ͽἀ-῿]/.test(s);
}
export function detectLang(s: string): GematriaLang {
  if (!s) return "english";
  if (isHebrew(s)) return "hebrew";
  if (isGreek(s)) return "greek";
  return "english";
}
function reduceToDigit(n: number): number {
  n = Math.abs(n | 0);
  while (n > 9) n = String(n).split("").reduce((s, d) => s + +d, 0);
  return n;
}
function triangular(n: number): number {
  return (n * (n + 1)) / 2;
}

// ── HEBREW SYSTEMS ─────────────────────────────────────────────────────
function hebSum(s: string, table: Table): number {
  let n = 0;
  for (const ch of lower(s)) {
    const v = table[ch];
    if (v) n += v;
  }
  return n;
}
function misparHechrachi(s: string): number {
  return hebSum(s, HEBREW_BASE);
}
function misparGadol(s: string): number {
  return hebSum(s, { ...HEBREW_BASE, ...HEBREW_FINALS500 });
}
function misparSidduri(s: string): number {
  return hebSum(s, HEBREW_ORDINAL);
}
function misparKatan(s: string): number {
  let n = 0;
  for (const ch of lower(s)) {
    const v = HEBREW_BASE[ch];
    if (v) n += reduceToDigit(v);
  }
  return n;
}
function misparKatanMispari(s: string): number {
  return reduceToDigit(misparHechrachi(s));
}
function misparBoneh(s: string): number {
  let running = 0;
  let total = 0;
  for (const ch of lower(s)) {
    const v = HEBREW_BASE[ch];
    if (v) {
      running += v;
      total += running;
    }
  }
  return total;
}
function misparKidmi(s: string): number {
  let n = 0;
  for (const ch of lower(s)) {
    const v = HEBREW_BASE[ch];
    if (v) n += triangular(v);
  }
  return n;
}
function atbash(s: string): Transform {
  const ABC = HEBREW_ORDER;
  let out = "";
  for (const ch of lower(s)) {
    const i = ABC.indexOf(ch);
    if (i >= 0) {
      out += ABC[ABC.length - 1 - i] ?? "";
    } else if (HEBREW_NAMES[ch] === undefined && /[֐-׿]/.test(ch)) {
      const base =
        ch === "ך" ? "כ" : ch === "ם" ? "מ" : ch === "ן" ? "נ" : ch === "ף" ? "פ" : ch === "ץ" ? "צ" : "";
      if (base) {
        const j = ABC.indexOf(base);
        if (j >= 0) out += ABC[ABC.length - 1 - j] ?? "";
      }
    }
  }
  return { transformed: out, value: misparHechrachi(out) };
}
function albam(s: string): Transform {
  const ABC = HEBREW_ORDER;
  const H = 11;
  let out = "";
  for (const ch of lower(s)) {
    const i = ABC.indexOf(ch);
    if (i >= 0) out += ABC[(i + H) % 22] ?? "";
  }
  return { transformed: out, value: misparHechrachi(out) };
}
function misparNeelam(s: string): number {
  let n = 0;
  for (const ch of lower(s)) {
    const name = HEBREW_NAMES[ch];
    if (!name) continue;
    n += misparHechrachi(name) - (HEBREW_BASE[ch] || 0);
  }
  return n;
}
function misparHaakhor(s: string): number {
  let n = 0;
  let i = 1;
  for (const ch of lower(s)) {
    const v = HEBREW_BASE[ch];
    if (v) {
      n += v * i;
      i++;
    }
  }
  return n;
}

// ── GREEK SYSTEMS ──────────────────────────────────────────────────────
function isopsephyStandard(s: string): number {
  let n = 0;
  for (const ch of lower(s)) {
    const v = GREEK_BASE[ch];
    if (v) n += v;
  }
  return n;
}
function isopsephyOrdinal(s: string): number {
  let n = 0;
  for (const ch of lower(s)) {
    const v = GREEK_ORDINAL[ch];
    if (v) n += v;
  }
  return n;
}
function isopsephyReduced(s: string): number {
  return reduceToDigit(isopsephyStandard(s));
}

// ── ENGLISH SYSTEMS ────────────────────────────────────────────────────
function englishOrdinal(s: string): number {
  let n = 0;
  for (const ch of (s || "").toLowerCase()) {
    const c = ch.charCodeAt(0);
    if (c >= 97 && c <= 122) n += c - 96;
  }
  return n;
}
function englishReduction(s: string): number {
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
function englishReverse(s: string): number {
  let n = 0;
  for (const ch of (s || "").toLowerCase()) {
    const c = ch.charCodeAt(0);
    if (c >= 97 && c <= 122) n += 27 - (c - 96);
  }
  return n;
}

// ── grouped namespaces (mirror window.CODEX_GEMATRIA) ───────────────────
export const hebrew = {
  hechrachi: misparHechrachi,
  gadol: misparGadol,
  sidduri: misparSidduri,
  katan: misparKatan,
  katan_mispari: misparKatanMispari,
  boneh: misparBoneh,
  kidmi: misparKidmi,
  atbash,
  albam,
  neelam: misparNeelam,
  haakhor: misparHaakhor,
};

export const greek = {
  isopsephy: isopsephyStandard,
  ordinal: isopsephyOrdinal,
  reduced: isopsephyReduced,
};

export const english = {
  ordinal: englishOrdinal,
  reduction: englishReduction,
  reverse: englishReverse,
};

// ── BUNDLE: compute all applicable systems ──────────────────────────────
export function all(text: string, lang?: GematriaLang): GematriaResult {
  const L = lang || detectLang(text);
  if (L === "hebrew") {
    return {
      lang: "hebrew",
      hechrachi: misparHechrachi(text),
      gadol: misparGadol(text),
      sidduri: misparSidduri(text),
      katan: misparKatan(text),
      katan_mispari: misparKatanMispari(text),
      boneh: misparBoneh(text),
      kidmi: misparKidmi(text),
      atbash: atbash(text),
      albam: albam(text),
      neelam: misparNeelam(text),
      haakhor: misparHaakhor(text),
    };
  }
  if (L === "greek") {
    return {
      lang: "greek",
      isopsephy: isopsephyStandard(text),
      ordinal: isopsephyOrdinal(text),
      reduced: isopsephyReduced(text),
    };
  }
  return {
    lang: "english",
    ordinal: englishOrdinal(text),
    reduction: englishReduction(text),
    reverse: englishReverse(text),
  };
}
