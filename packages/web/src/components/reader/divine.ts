// reader (soul) — the divine-name engine (migrated verbatim from reader.jsx).
// Pure data in, segments out; no DOM (law 5). Conservative by design: only
// forms that are *names of God* in the registry's translation conventions ever
// match. "gods", "godly", lowercase "lord of the manor" can never gild.
//
//   kind "tetra" — stands for the Tetragrammaton in this translation's
//                  convention (LORD/GOD small-caps, Jehovah, l'Éternel,
//                  SEÑOR, HERR, SENHOR, יהוה…). May render as יהוה when
//                  the user opts into divineHebrew.
//   kind "name"  — God/Elohim/Theos/Dios/Dieu… — gold, never substituted
//                  (these are NOT the Tetragrammaton).

export type DivineKind = "tetra" | "name";

export interface DivineRule {
  kind: DivineKind;
  re: RegExp;
}

export interface DivineSeg {
  t: string;
  kind: DivineKind | null;
}

interface DivineHit {
  start: number;
  end: number;
  kind: DivineKind;
}

export const CXR_DIVINE_RULES: DivineRule[] = [
  // English — the small-caps print convention survives APIs as ALL-CAPS.
  { kind: "tetra", re: /\b(?:LORD|GOD|JEHOVAH)(?:['’]S)?\b/g },
  { kind: "tetra", re: /\b(?:Jehovah|Yahweh|YHWH)(?:['’]s)?\b/g },
  // English "God" — Elohim/Theos. Case-sensitive + \b: never "gods"/"godly".
  { kind: "name", re: /\bGod(?:['’]s)?\b/g },
  // Hebrew — the Tetragrammaton itself (with or without niqqud/cantillation),
  // then Elohim / Adonai (pointed + consonantal).
  { kind: "tetra", re: /יְ?הֹ?וָ?ה|יהוה/g },
  { kind: "name", re: /אֱלֹהִים|אלהים|אֲדֹנָי|אדני/g },
  // Greek (LXX/NT) — Theos forms only. Κύριος is left alone: in the NT it
  // routinely names Jesus / a human master — gilding it would overclaim.
  { kind: "name", re: /(?<!\p{L})(?:Θεός|Θεὸς|Θεοῦ|Θεῷ|Θεόν|ΘΕΟΣ|θεός|θεὸς|θεοῦ|θεῷ|θεόν)(?!\p{L})/gu },
  // Spanish — Reina-Valera prints Jehová for YHWH; all-caps SEÑOR likewise.
  { kind: "tetra", re: /(?<!\p{L})(?:SEÑOR|Jehová|Jehova)(?!\p{L})/gu },
  { kind: "name", re: /\bDios\b/g },
  // French — Segond's l'Éternel IS the Tetragrammaton.
  { kind: "tetra", re: /(?<!\p{L})(?:ÉTERNEL|Éternel)(?!\p{L})/gu },
  { kind: "name", re: /\bDieu\b/g },
  // German — Luther/Elberfelder all-caps HERR = YHWH. Mixed-case "Herr" is
  // left alone (can be a human lord). Gott is the Name.
  { kind: "tetra", re: /\bHERRN?\b/g },
  { kind: "name", re: /\bGott(?:es)?\b/g },
  // Portuguese — Almeida all-caps SENHOR = YHWH.
  { kind: "tetra", re: /\bSENHOR\b/g },
  { kind: "name", re: /\bDeus\b/g },
  // Latin — the Vulgate never distinguishes YHWH: gold only, no swap.
  { kind: "name", re: /\bD(?:ominus|omini|omino|ominum|omine|eus|ei|eo|eum)\b/g },
  // Hindi — यहोवा is the BSI rendering of YHWH; परमेश्वर is the Name.
  { kind: "tetra", re: /यहोवा/g },
  { kind: "name", re: /परमेश्‍?वर/g },
];

// segment(text) → [{ t, kind: null|"tetra"|"name" }]. NFC-normalised so
// composed/decomposed accents (Greek, Hebrew niqqud) match identically.
export function cxrDivineSegment(text: string | null | undefined): DivineSeg[] {
  if (!text) return [{ t: text || "", kind: null }];
  const s = text.normalize ? text.normalize("NFC") : text;
  const hits: DivineHit[] = [];
  for (const rule of CXR_DIVINE_RULES) {
    rule.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = rule.re.exec(s)) !== null) {
      if (m[0]) hits.push({ start: m.index, end: m.index + m[0].length, kind: rule.kind });
      if (rule.re.lastIndex === m.index) rule.re.lastIndex++;
    }
  }
  if (!hits.length) return [{ t: s, kind: null }];
  // Resolve overlaps: earliest first; on tie, longest; tetra beats name.
  hits.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start) || (a.kind === "tetra" ? -1 : 1));
  const picked: DivineHit[] = [];
  let cursor = 0;
  for (const h of hits) {
    if (h.start < cursor) continue;
    picked.push(h);
    cursor = h.end;
  }
  const out: DivineSeg[] = [];
  let i = 0;
  for (const h of picked) {
    if (h.start > i) out.push({ t: s.slice(i, h.start), kind: null });
    out.push({ t: s.slice(h.start, h.end), kind: h.kind });
    i = h.end;
  }
  if (i < s.length) out.push({ t: s.slice(i), kind: null });
  return out;
}
