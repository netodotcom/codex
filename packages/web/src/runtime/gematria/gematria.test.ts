// @vitest-environment jsdom
// Gematria — faithful-port tests. Expectations are derived directly from the
// legacy letter-value tables; any mismatch is a regression in the port.
import { describe, it, expect, beforeAll } from "vitest";
import {
  strip, detectLang,
  reduceToDigit, triangular,
  mispar_hechrachi, mispar_gadol, mispar_sidduri,
  mispar_katan, mispar_katan_mispari, mispar_boneh, mispar_kidmi,
  atbash, albam, mispar_neelam, mispar_haakhor,
  isopsephy_standard, isopsephy_ordinal, isopsephy_reduced,
  english_ordinal, english_reduction, english_reverse,
  all,
} from "./helpers.js";

// ── localStorage mock (jsdom's built-in shim is unreliable) ──────────────────
function installStorage(): void {
  const store: Record<string, string> = {};
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem:    (k: string): string | null =>
        Object.prototype.hasOwnProperty.call(store, k) ? (store[k] as string) : null,
      setItem:    (k: string, v: string): void => { store[k] = String(v); },
      removeItem: (k: string): void => { delete store[k]; },
      clear:      (): void => { for (const k of Object.keys(store)) delete store[k]; },
    },
  });
}
installStorage();

// Import the entry point to assign both window globals (mirrors runtime boot).
beforeAll(async () => {
  await import("./index.js");
});

// ── Normalization ─────────────────────────────────────────────────────────────
describe("strip()", () => {
  it("removes Hebrew nikud and cantillation marks", () => {
    // אַ֫הֲבָ֖ה (pointed ahavah) → אהבה (bare consonants)
    expect(strip("אַ֫הֲבָ֖ה")).toBe("אהבה");
  });

  it("removes Greek diacritics (acute accent)", () => {
    expect(strip("λόγος")).toBe("λογος");
  });

  it("is a no-op on plain ASCII", () => {
    expect(strip("hello")).toBe("hello");
  });

  it("treats null-ish via (s||'')", () => {
    // empty string in → empty out
    expect(strip("")).toBe("");
  });
});

// ── detectLang ────────────────────────────────────────────────────────────────
describe("detectLang()", () => {
  it("Hebrew script → 'hebrew'", () => {
    expect(detectLang("שלום")).toBe("hebrew");
    expect(detectLang("אהבה")).toBe("hebrew");
  });

  it("Greek script → 'greek'", () => {
    expect(detectLang("λόγος")).toBe("greek");
    expect(detectLang("ιησους")).toBe("greek");
  });

  it("Latin / empty → 'english'", () => {
    expect(detectLang("hello")).toBe("english");
    expect(detectLang("")).toBe("english");
  });
});

// ── reduceToDigit ─────────────────────────────────────────────────────────────
describe("reduceToDigit()", () => {
  it("single digit stays as-is", () => { expect(reduceToDigit(7)).toBe(7); });
  it("negative is treated as absolute", () => { expect(reduceToDigit(-7)).toBe(7); });
  it("376 → 16 → 7", () => { expect(reduceToDigit(376)).toBe(7); });
  it("373 → 13 → 4", () => { expect(reduceToDigit(373)).toBe(4); });
  it("0 → 0", () => { expect(reduceToDigit(0)).toBe(0); });
});

// ── triangular ────────────────────────────────────────────────────────────────
describe("triangular()", () => {
  it("triangular(1) = 1", () => { expect(triangular(1)).toBe(1); });
  it("triangular(2) = 3", () => { expect(triangular(2)).toBe(3); });
  it("triangular(10) = 55", () => { expect(triangular(10)).toBe(55); });
});

// ── mispar_hechrachi (standard / Mispar Hechrachi) ───────────────────────────
describe("mispar_hechrachi()", () => {
  it("aleph (א) = 1", () => { expect(mispar_hechrachi("א")).toBe(1); });
  it("shin (ש) = 300", () => { expect(mispar_hechrachi("ש")).toBe(300); });
  it("tav (ת) = 400", () => { expect(mispar_hechrachi("ת")).toBe(400); });

  it("shalom (שלום) = ש300 + ל30 + ו6 + מ40 = 376", () => {
    expect(mispar_hechrachi("שלום")).toBe(376);
  });

  it("ahavah (אהבה) = א1 + ה5 + ב2 + ה5 = 13", () => {
    expect(mispar_hechrachi("אהבה")).toBe(13);
  });

  it("pointed ahavah strips to same value 13", () => {
    expect(mispar_hechrachi("אַ֫הֲבָ֖ה")).toBe(13);
  });

  it("finals collapse: final kaf (ך) = 20 (same as כ)", () => {
    expect(mispar_hechrachi("ך")).toBe(20);
  });

  it("finals collapse: final mem (ם) = 40 (same as מ)", () => {
    expect(mispar_hechrachi("ם")).toBe(40);
  });

  it("finals collapse: final nun (ן) = 50", () => {
    expect(mispar_hechrachi("ן")).toBe(50);
  });

  it("finals collapse: final pe (ף) = 80", () => {
    expect(mispar_hechrachi("ף")).toBe(80);
  });

  it("finals collapse: final tsadi (ץ) = 90", () => {
    expect(mispar_hechrachi("ץ")).toBe(90);
  });

  it("empty string → 0", () => { expect(mispar_hechrachi("")).toBe(0); });
  it("non-Hebrew chars contribute 0", () => { expect(mispar_hechrachi("abc")).toBe(0); });
});

// ── mispar_gadol (finals elevated to 500-900) ─────────────────────────────────
describe("mispar_gadol()", () => {
  it("final kaf (ך) = 500", () => { expect(mispar_gadol("ך")).toBe(500); });
  it("final mem (ם) = 600", () => { expect(mispar_gadol("ם")).toBe(600); });
  it("final nun (ן) = 700", () => { expect(mispar_gadol("ן")).toBe(700); });
  it("final pe  (ף) = 800", () => { expect(mispar_gadol("ף")).toBe(800); });
  it("final tsadi (ץ) = 900", () => { expect(mispar_gadol("ץ")).toBe(900); });

  it("base kaf (כ) still = 20", () => { expect(mispar_gadol("כ")).toBe(20); });
  it("base aleph unchanged = 1", () => { expect(mispar_gadol("א")).toBe(1); });
});

// ── mispar_sidduri (ordinal) ──────────────────────────────────────────────────
describe("mispar_sidduri()", () => {
  it("aleph = 1 (1st letter)", () => { expect(mispar_sidduri("א")).toBe(1); });
  it("kaf = 11 (11th letter)",  () => { expect(mispar_sidduri("כ")).toBe(11); });
  it("tav = 22 (22nd letter)", () => { expect(mispar_sidduri("ת")).toBe(22); });

  // שלום: ש(21)+ל(12)+ו(6)+מ(13) = 52
  it("shalom = 52", () => { expect(mispar_sidduri("שלום")).toBe(52); });

  it("final kaf (ך) ordinal = same as kaf (כ) = 11", () => {
    expect(mispar_sidduri("ך")).toBe(mispar_sidduri("כ"));
  });
});

// ── mispar_katan ──────────────────────────────────────────────────────────────
describe("mispar_katan()", () => {
  // שלום: ש→reduceToDigit(300)=3, ל→reduceToDigit(30)=3, ו→6, מ→reduceToDigit(40)=4 = 16
  it("shalom = 16", () => { expect(mispar_katan("שלום")).toBe(16); });
  it("aleph = reduceToDigit(1) = 1", () => { expect(mispar_katan("א")).toBe(1); });
  it("kuf (ק=100) = reduceToDigit(100) = 1", () => { expect(mispar_katan("ק")).toBe(1); });
});

// ── mispar_katan_mispari ──────────────────────────────────────────────────────
describe("mispar_katan_mispari()", () => {
  // shalom hechrachi=376 → 3+7+6=16 → 1+6=7
  it("shalom 376 → 7", () => { expect(mispar_katan_mispari("שלום")).toBe(7); });
});

// ── mispar_boneh (building / cumulative) ─────────────────────────────────────
describe("mispar_boneh()", () => {
  // שלום: running: 300,330,336,376 → total: 300+330+336+376 = 1342
  it("shalom = 1342", () => { expect(mispar_boneh("שלום")).toBe(1342); });
  it("single letter = its own value", () => { expect(mispar_boneh("א")).toBe(1); });
});

// ── mispar_kidmi (triangular) ─────────────────────────────────────────────────
describe("mispar_kidmi()", () => {
  it("aleph = triangular(1) = 1", () => { expect(mispar_kidmi("א")).toBe(triangular(1)); });
  it("bet  = triangular(2) = 3",  () => { expect(mispar_kidmi("ב")).toBe(triangular(2)); });
  // ו=6 → triangular(6)=21; single letter
  it("waw  = triangular(6) = 21", () => { expect(mispar_kidmi("ו")).toBe(21); });
});

// ── atbash ────────────────────────────────────────────────────────────────────
describe("atbash()", () => {
  it("aleph (א) ↔ tav (ת), value=400", () => {
    const r = atbash("א");
    expect(r.transformed).toBe("ת");
    expect(r.value).toBe(400);
  });

  it("tav (ת) ↔ aleph (א), value=1", () => {
    const r = atbash("ת");
    expect(r.transformed).toBe("א");
    expect(r.value).toBe(1);
  });

  it("bet (ב) ↔ shin (ש), value=300", () => {
    const r = atbash("ב");
    expect(r.transformed).toBe("ש");
    expect(r.value).toBe(300);
  });

  it("value field equals hechrachi of transformed string", () => {
    const r = atbash("שלום");
    expect(r.value).toBe(mispar_hechrachi(r.transformed));
  });
});

// ── albam ─────────────────────────────────────────────────────────────────────
describe("albam()", () => {
  it("aleph (א pos=0) → lamed (ל pos=11), value=30", () => {
    const r = albam("א");
    expect(r.transformed).toBe("ל");
    expect(r.value).toBe(30);
  });

  it("lamed (ל pos=11) → aleph (א pos=0), value=1", () => {
    const r = albam("ל");
    expect(r.transformed).toBe("א");
    expect(r.value).toBe(1);
  });

  it("value field equals hechrachi of transformed string", () => {
    const r = albam("שלום");
    expect(r.value).toBe(mispar_hechrachi(r.transformed));
  });
});

// ── mispar_neelam (hidden) ────────────────────────────────────────────────────
describe("mispar_neelam()", () => {
  // aleph: name="אלף"→hechrachi=111; minus aleph(1) = 110
  it("aleph hidden = 110 (name 'alef' minus first letter)", () => {
    expect(mispar_neelam("א")).toBe(110);
  });

  // bet: name="בית"→ב2+י10+ת400=412; minus bet(2) = 410
  it("bet hidden = 410", () => {
    expect(mispar_neelam("ב")).toBe(410);
  });

  it("non-letter chars contribute 0", () => {
    expect(mispar_neelam("hello")).toBe(0);
  });
});

// ── mispar_haakhor (positional multiply) ─────────────────────────────────────
describe("mispar_haakhor()", () => {
  // shalom: ש(300×1)+ל(30×2)+ו(6×3)+מ(40×4) = 300+60+18+160 = 538
  it("shalom = 538", () => { expect(mispar_haakhor("שלום")).toBe(538); });
  it("single letter value×1 = hechrachi", () => {
    expect(mispar_haakhor("א")).toBe(mispar_hechrachi("א"));
  });
});

// ── Greek — isopsephy_standard ────────────────────────────────────────────────
describe("isopsephy_standard()", () => {
  // λόγος → strip → λογος: λ30+ο70+γ3+ο70+ς200 = 373
  it("logos (λόγος) = 373", () => {
    expect(isopsephy_standard("λόγος")).toBe(373);
  });

  // ιησους: ι10+η8+σ200+ο70+υ400+ς200 = 888
  it("iesous (ιησους) = 888", () => {
    expect(isopsephy_standard("ιησους")).toBe(888);
  });

  // σ and ς both = 200
  it("final sigma (ς) = 200 same as medial sigma (σ)", () => {
    expect(isopsephy_standard("ς")).toBe(200);
    expect(isopsephy_standard("σ")).toBe(200);
  });

  it("alpha (α) = 1", () => { expect(isopsephy_standard("α")).toBe(1); });
  it("omega (ω) = 800", () => { expect(isopsephy_standard("ω")).toBe(800); });
  it("empty → 0", () => { expect(isopsephy_standard("")).toBe(0); });
});

// ── Greek — isopsephy_ordinal ─────────────────────────────────────────────────
describe("isopsephy_ordinal()", () => {
  it("alpha ordinal = 1", () => { expect(isopsephy_ordinal("α")).toBe(1); });
  it("omega ordinal = 24 (24th in GREEK_ORDER)", () => {
    expect(isopsephy_ordinal("ω")).toBe(24);
  });
  it("final sigma ordinal = same as sigma", () => {
    expect(isopsephy_ordinal("ς")).toBe(isopsephy_ordinal("σ"));
  });
});

// ── Greek — isopsephy_reduced ─────────────────────────────────────────────────
describe("isopsephy_reduced()", () => {
  // logos 373 → 3+7+3=13 → 1+3=4
  it("logos reduced = 4", () => {
    expect(isopsephy_reduced("λόγος")).toBe(reduceToDigit(373));
    expect(isopsephy_reduced("λόγος")).toBe(4);
  });
  // iesous 888 → 8+8+8=24 → 2+4=6
  it("iesous reduced = 6", () => {
    expect(isopsephy_reduced("ιησους")).toBe(6);
  });
});

// ── English — ordinal ─────────────────────────────────────────────────────────
describe("english_ordinal()", () => {
  it("a = 1", () => { expect(english_ordinal("a")).toBe(1); });
  it("z = 26", () => { expect(english_ordinal("z")).toBe(26); });
  // b(2)+i(9)+b(2)+l(12)+e(5) = 30
  it("'bible' = 30", () => { expect(english_ordinal("bible")).toBe(30); });
  // h(8)+e(5)+l(12)+l(12)+o(15) = 52
  it("'hello' = 52", () => { expect(english_ordinal("hello")).toBe(52); });
  it("non-alpha chars contribute 0", () => { expect(english_ordinal("abc123")).toBe(6); });
  it("uppercase treated same as lowercase", () => {
    expect(english_ordinal("ABC")).toBe(english_ordinal("abc"));
  });
});

// ── English — reduction ───────────────────────────────────────────────────────
describe("english_reduction()", () => {
  // b=2→2, i=9→9, b=2→2, l=12→((12-1)%9+1=3), e=5→5  = 21
  it("'bible' reduction = 21", () => { expect(english_reduction("bible")).toBe(21); });
  it("a reduction = 1", () => { expect(english_reduction("a")).toBe(1); });
  // z=26 → (25%9)+1 = 7+1 = 8
  it("z reduction = 8", () => { expect(english_reduction("z")).toBe(8); });
});

// ── English — reverse ─────────────────────────────────────────────────────────
describe("english_reverse()", () => {
  it("a = 26 (27-1)", () => { expect(english_reverse("a")).toBe(26); });
  it("z = 1  (27-26)", () => { expect(english_reverse("z")).toBe(1); });
  // b(25)+i(18)+b(25)+l(15)+e(22) = 105
  it("'bible' reverse = 105", () => { expect(english_reverse("bible")).toBe(105); });
});

// ── all() bundle ──────────────────────────────────────────────────────────────
describe("all()", () => {
  it("Hebrew input → full Hebrew result", () => {
    const r = all("שלום");
    expect(r.lang).toBe("hebrew");
    if (r.lang === "hebrew") {
      expect(r.hechrachi).toBe(376);
      expect(r.gadol).toBe(936); // ם (final mem) is elevated to 600 in Gadol: 300+30+6+600=936
      expect(r.sidduri).toBe(52);
      expect(r.katan).toBe(16);
      expect(r.katan_mispari).toBe(7);
      expect(r.boneh).toBe(1342);
      expect(r.haakhor).toBe(538);
    }
  });

  it("Greek input → full Greek result", () => {
    const r = all("λόγος");
    expect(r.lang).toBe("greek");
    if (r.lang === "greek") {
      expect(r.isopsephy).toBe(373);
      expect(r.reduced).toBe(4);
    }
  });

  it("English input → full English result", () => {
    const r = all("bible");
    expect(r.lang).toBe("english");
    if (r.lang === "english") {
      expect(r.ordinal).toBe(30);
      expect(r.reduction).toBe(21);
      expect(r.reverse).toBe(105);
    }
  });

  it("lang override forces the system even on Hebrew text", () => {
    const r = all("שלום", "english");
    expect(r.lang).toBe("english");
  });
});

// ── window.CODEX_GEMATRIA surface ────────────────────────────────────────────
describe("window.CODEX_GEMATRIA (global contract)", () => {
  type G = {
    detectLang: unknown; strip: unknown; all: unknown;
    hebrew: Record<string, unknown>;
    greek:   Record<string, unknown>;
    english: Record<string, unknown>;
  };
  const g = (): G => (window as unknown as { CODEX_GEMATRIA: G }).CODEX_GEMATRIA;

  it("typeof CODEX_GEMATRIA === 'object' (parity probe requirement)", () => {
    expect(typeof (window as unknown as Record<string, unknown>)["CODEX_GEMATRIA"]).toBe("object");
  });

  it("exposes detectLang, strip, all as functions", () => {
    expect(typeof g().detectLang).toBe("function");
    expect(typeof g().strip).toBe("function");
    expect(typeof g().all).toBe("function");
  });

  it("hebrew sub-object has all 11 method keys", () => {
    const h = g().hebrew;
    for (const k of [
      "hechrachi", "gadol", "sidduri", "katan", "katan_mispari",
      "boneh", "kidmi", "atbash", "albam", "neelam", "haakhor",
    ]) expect(typeof h[k]).toBe("function");
  });

  it("greek sub-object has isopsephy / ordinal / reduced", () => {
    const gr = g().greek;
    expect(typeof gr["isopsephy"]).toBe("function");
    expect(typeof gr["ordinal"]).toBe("function");
    expect(typeof gr["reduced"]).toBe("function");
  });

  it("english sub-object has ordinal / reduction / reverse", () => {
    const en = g().english;
    expect(typeof en["ordinal"]).toBe("function");
    expect(typeof en["reduction"]).toBe("function");
    expect(typeof en["reverse"]).toBe("function");
  });

  it("window.CODEX_GEMATRIA.hebrew.hechrachi('שלום') = 376", () => {
    type H = { hebrew: { hechrachi: (s: string) => number } };
    const gg = window as unknown as { CODEX_GEMATRIA: H };
    expect(gg.CODEX_GEMATRIA.hebrew.hechrachi("שלום")).toBe(376);
  });

  it("window.CODEX_GEMATRIA.greek.isopsephy('λόγος') = 373", () => {
    type GR = { greek: { isopsephy: (s: string) => number } };
    const gg = window as unknown as { CODEX_GEMATRIA: GR };
    expect(gg.CODEX_GEMATRIA.greek.isopsephy("λόγος")).toBe(373);
  });

  it("window.CODEX_GEMATRIA.english.ordinal('bible') = 30", () => {
    type EN = { english: { ordinal: (s: string) => number } };
    const gg = window as unknown as { CODEX_GEMATRIA: EN };
    expect(gg.CODEX_GEMATRIA.english.ordinal("bible")).toBe(30);
  });
});

// ── window.CODEX_GEMATRIA_INDEX surface ──────────────────────────────────────
describe("window.CODEX_GEMATRIA_INDEX (global contract)", () => {
  type Idx = {
    build: unknown; find: unknown; stats: unknown; reset: unknown; ensure: unknown;
  };
  const idx = (): Idx => (window as unknown as { CODEX_GEMATRIA_INDEX: Idx }).CODEX_GEMATRIA_INDEX;

  it("typeof CODEX_GEMATRIA_INDEX === 'object' (parity probe requirement)", () => {
    expect(typeof (window as unknown as Record<string, unknown>)["CODEX_GEMATRIA_INDEX"]).toBe("object");
  });

  it("exposes build / find / stats / reset / ensure as functions", () => {
    for (const k of ["build", "find", "stats", "reset", "ensure"]) {
      expect(typeof (idx() as Record<string, unknown>)[k]).toBe("function");
    }
  });

  it("stats() returns { values, matches, builtAt } shape", () => {
    type I2 = { stats: () => { values: number; matches: number; builtAt: number } };
    const s = (window as unknown as { CODEX_GEMATRIA_INDEX: I2 }).CODEX_GEMATRIA_INDEX.stats();
    expect(typeof s.values).toBe("number");
    expect(typeof s.matches).toBe("number");
    expect(typeof s.builtAt).toBe("number");
  });

  it("find() on an empty / fresh index returns an array", () => {
    type I2 = { reset: () => void; find: (v: number) => unknown[] };
    const i2 = window as unknown as { CODEX_GEMATRIA_INDEX: I2 };
    i2.CODEX_GEMATRIA_INDEX.reset();
    const result = i2.CODEX_GEMATRIA_INDEX.find(376);
    expect(Array.isArray(result)).toBe(true);
  });

  it("reset() zeroes stats", () => {
    type I2 = {
      reset: () => void;
      stats: () => { values: number; matches: number; builtAt: number };
    };
    const i2 = (window as unknown as { CODEX_GEMATRIA_INDEX: I2 }).CODEX_GEMATRIA_INDEX;
    i2.reset();
    const s = i2.stats();
    expect(s.values).toBe(0);
    expect(s.matches).toBe(0);
    expect(s.builtAt).toBe(0);
  });
});
