// Gematria — letter-value tables. Migrated verbatim from legacy/gematria.js.
// All table shapes, ordinal rules and special cases are preserved exactly.

// Hebrew base values (Mispar Hechrachi). Finals collapse to base by default;
// finals500 lifts them (כ=500..ץ=900) — useful when explicitly requested.
export const HEBREW_BASE: Record<string, number> = {
  א: 1,   ב: 2,   ג: 3,   ד: 4,   ה: 5,   ו: 6,   ז: 7,   ח: 8,   ט: 9,
  י: 10,  כ: 20,  ל: 30,  מ: 40,  נ: 50,  ס: 60,  ע: 70,  פ: 80,  צ: 90,
  ק: 100, ר: 200, ש: 300, ת: 400,
  // finals collapse by default
  ך: 20,  ם: 40,  ן: 50,  ף: 80,  ץ: 90,
};

export const HEBREW_FINALS500: Record<string, number> = {
  ך: 500, ם: 600, ן: 700, ף: 800, ץ: 900,
};

export const HEBREW_ORDER = "אבגדהוזחטיכלמנסעפצקרשת";

// NOTE: preserved from legacy — finals get the same ordinal as their base form.
export const HEBREW_ORDINAL: Record<string, number> = (() => {
  const o: Record<string, number> = {};
  [...HEBREW_ORDER].forEach((c, i) => { o[c] = i + 1; });
  o["ך"] = o["כ"]!; o["ם"] = o["מ"]!; o["ן"] = o["נ"]!; o["ף"] = o["פ"]!; o["ץ"] = o["צ"]!;
  return o;
})();

// Spelled-out letter NAMES (used by Mispar Neelam — "hidden" = name minus first letter).
export const HEBREW_NAMES: Record<string, string> = {
  א: "אלף", ב: "בית",  ג: "גימל", ד: "דלת", ה: "הא",
  ו: "וו",  ז: "זין",  ח: "חית",  ט: "טית", י: "יוד",
  כ: "כף",  ל: "למד",  מ: "מם",   נ: "נון", ס: "סמך",
  ע: "עין", פ: "פא",   צ: "צדי",  ק: "קוף", ר: "ריש",
  ש: "שין", ת: "תיו",
};

// Greek isopsephy (classical 27-letter set; stigma/koppa/sampi for 6/90/900).
export const GREEK_BASE: Record<string, number> = {
  α: 1,   β: 2,   γ: 3,   δ: 4,   ε: 5,   ϛ: 6,   ζ: 7,   η: 8,   θ: 9,
  ι: 10,  κ: 20,  λ: 30,  μ: 40,  ν: 50,  ξ: 60,  ο: 70,  π: 80,  ϟ: 90,
  ρ: 100, σ: 200, ς: 200, τ: 300, υ: 400, φ: 500, χ: 600, ψ: 700, ω: 800, ϡ: 900,
};

export const GREEK_ORDER = "αβγδεζηθικλμνξοπρστυφχψω"; // ordinal 1..24

// NOTE: preserved from legacy — final sigma (ς) gets the same ordinal as sigma (σ).
export const GREEK_ORDINAL: Record<string, number> = (() => {
  const o: Record<string, number> = {};
  [...GREEK_ORDER].forEach((c, i) => { o[c] = i + 1; });
  o["ς"] = o["σ"]!;
  return o;
})();
