// textflow — pure logic: Talmud tractate list and spec normaliser.
// Faithful port of TEXTFLOW_TRACTATES and textflowParse from textflow.jsx.
// No DOM access; safe to unit-test in Node.

export type ParsedSpec =
  | { kind: "sefaria"; tref: string; label: string }
  | { kind: "bible"; ref: string };

export const TEXTFLOW_TRACTATES: readonly string[] = [
  "Berakhot", "Shabbat", "Eruvin", "Pesachim", "Shekalim", "Yoma", "Sukkah", "Beitzah",
  "Rosh Hashanah", "Taanit", "Megillah", "Moed Katan", "Chagigah", "Yevamot", "Ketubot",
  "Nedarim", "Nazir", "Sotah", "Gittin", "Kiddushin", "Bava Kamma", "Bava Metzia",
  "Bava Batra", "Sanhedrin", "Makkot", "Shevuot", "Avodah Zarah", "Horayot", "Zevachim",
  "Menachot", "Chullin", "Bekhorot", "Arakhin", "Temurah", "Keritot", "Meilah", "Tamid",
  "Niddah",
];

// Normalize "talmud.Berakhot.2a" / "Berakhot 2a" / "berakhot.2a" → Sefaria tref.
// Returns null for empty input, for talmud-shaped-but-unresolvable input,
// or returns { kind: "bible", ref } for anything else.
export function textflowParse(spec: unknown): ParsedSpec | null {
  const s = String(spec || "").trim();
  if (!s) return null;
  const cleaned = s.replace(/^talmud[.\s]+/i, "").replace(/[.\s]+/g, " ").trim();
  const m = cleaned.match(/^(.+?)\s+(\d+[ab]?)$/i);
  if (m) {
    const namePart = m[1];
    const folioPart = m[2];
    if (namePart !== undefined && folioPart !== undefined) {
      const name = namePart.toLowerCase();
      const tractate =
        TEXTFLOW_TRACTATES.find((t) => t.toLowerCase() === name) ??
        TEXTFLOW_TRACTATES.find((t) => t.toLowerCase().startsWith(name));
      if (tractate) {
        return {
          kind: "sefaria",
          tref: `${tractate}.${folioPart}`,
          label: `${tractate} ${folioPart}`,
        };
      }
    }
  }
  if (/^talmud\b/i.test(s)) return null; // talmud-shaped but unparseable
  return { kind: "bible", ref: s };
}
