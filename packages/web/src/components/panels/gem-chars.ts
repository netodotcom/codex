// panels — per-character gematria lookup for the interactive lexical grid
// (Backlog 4.1). Pure; extracted from panels.jsx (the inline GREEK/HEBREW tables
// used by the clickable letter values). Distinct from @codex/core's word-level
// systems — this is single-glyph value + script detection.

const GREEK: Record<string, number> = {
  α: 1, β: 2, γ: 3, δ: 4, ε: 5, ζ: 7, η: 8, θ: 9, ι: 10, κ: 20, λ: 30, μ: 40, ν: 50,
  ξ: 60, ο: 70, π: 80, ρ: 100, σ: 200, ς: 200, τ: 300, υ: 400, φ: 500, χ: 600, ψ: 700, ω: 800,
};

const HEBREW: Record<string, number> = {
  א: 1, ב: 2, ג: 3, ד: 4, ה: 5, ו: 6, ז: 7, ח: 8, ט: 9, י: 10, כ: 20, ך: 20, ל: 30,
  מ: 40, ם: 40, נ: 50, ן: 50, ס: 60, ע: 70, פ: 80, ף: 80, צ: 90, ץ: 90, ק: 100, ר: 200, ש: 300, ת: 400,
};

export interface GemChar {
  v: number;
  script: "Greek" | "Hebrew";
}

export function gemNormalize(ch: string): string {
  return ch.normalize("NFD").replace(/\p{M}/gu, "");
}

export function gemValueFor(ch: string): GemChar | null {
  const norm = gemNormalize(ch).toLowerCase();
  if (!norm) return null;
  const g = GREEK[norm];
  if (g) return { v: g, script: "Greek" };
  const h = HEBREW[norm];
  if (h) return { v: h, script: "Hebrew" };
  return null;
}

const GREEK_ORDER = "αβγδεζηθικλμνξοπρστυφχψω";
const HEBREW_ORDER = "אבגדהוזחטיכלמנסעפצקרשת";
const ORDINAL: Record<string, number> = (() => {
  const out: Record<string, number> = {};
  [...GREEK_ORDER].forEach((c, i) => (out[c] = i + 1));
  [...HEBREW_ORDER].forEach((c, i) => (out[c] = i + 1));
  return out;
})();

function digitalRoot(n: number): number {
  while (n > 9) n = String(n).split("").reduce((s, d) => s + +d, 0);
  return n;
}

export interface CalcResult {
  sum: number;
  script: string | null;
  ordinal: number;
  reduced: number;
  breakdown: Array<{ ch: string; v: number }>;
}

/** Live gematria calculator over arbitrary Greek/Hebrew input (the ∑ panel). */
export function computeGematriaCalc(text: string): CalcResult {
  let sum = 0;
  const scriptHits = { Greek: 0, Hebrew: 0 };
  const breakdown: Array<{ ch: string; v: number }> = [];
  for (const ch of text) {
    const r = gemValueFor(ch);
    if (r) {
      sum += r.v;
      scriptHits[r.script]++;
      breakdown.push({ ch, v: r.v });
    }
  }
  const script = scriptHits.Greek > scriptHits.Hebrew ? "Greek isopsephy" : scriptHits.Hebrew > 0 ? "Mispar Hechrachi" : null;
  let ordinal = 0;
  for (const ch of text) {
    const n = gemNormalize(ch).toLowerCase();
    const o = ORDINAL[n];
    if (o) ordinal += o;
  }
  return { sum, script, ordinal, reduced: digitalRoot(sum), breakdown };
}
