// artifacts — scripture-reference detection (migrated VERBATIM from
// artifacts.jsx, itself ported from the old oracle.jsx splitOnRefs). Full book
// names come from CODEX_DATA.books plus a hand-curated abbreviation table,
// matched longest-first. This is its own contract (3-letter book ids like "jhn",
// output shape { type, text, ref }) exposed as CODEX_ARTIFACTS.splitOnRefs — it
// is intentionally NOT @codex/core/refs (which uses a different slug model).
import { aw } from "./artifacts-window.js";

export interface RefData {
  bookId: string;
  chapter: number;
  verse: number | null;
  endVerse: number | null;
  label: string;
}

export type RefSeg =
  | { type: "text"; text: string }
  | { type: "ref"; text: string; ref: RefData };

export const ART_SHORT_BOOKS: Record<string, string> = {
  "Gn":"gen","Gen":"gen","Ge":"gen", "Ex":"exo","Exo":"exo", "Lv":"lev","Lev":"lev",
  "Nu":"num","Num":"num","Nm":"num", "Dt":"deu","Deu":"deu","Deut":"deu",
  "Jos":"jos","Josh":"jos", "Jdg":"jdg","Judg":"jdg", "Ru":"rut","Ruth":"rut",
  "1Sa":"1sa","1 Sam":"1sa","1Sam":"1sa","I Sam":"1sa","I Samuel":"1sa",
  "2Sa":"2sa","2 Sam":"2sa","2Sam":"2sa","II Sam":"2sa","II Samuel":"2sa",
  "1Ki":"1ki","1 Kings":"1ki","1Kgs":"1ki","I Kings":"1ki",
  "2Ki":"2ki","2 Kings":"2ki","2Kgs":"2ki","II Kings":"2ki",
  "1Ch":"1ch","1 Chr":"1ch","1Chr":"1ch","I Chronicles":"1ch",
  "2Ch":"2ch","2 Chr":"2ch","2Chr":"2ch","II Chronicles":"2ch",
  "Ezr":"ezr","Ezra":"ezr", "Neh":"neh","Ne":"neh", "Est":"est","Esth":"est",
  "Jb":"job","Job":"job", "Ps":"psa","Psa":"psa","Pss":"psa","Psalm":"psa","Psalms":"psa",
  "Pr":"pro","Prov":"pro","Prv":"pro", "Ec":"ecc","Eccl":"ecc","Qoh":"ecc",
  "Sg":"sng","Song":"sng","SoS":"sng","Cant":"sng", "Is":"isa","Isa":"isa",
  "Jr":"jer","Jer":"jer", "Lm":"lam","Lam":"lam", "Ez":"ezk","Ezek":"ezk",
  "Dn":"dan","Dan":"dan", "Hos":"hos","Ho":"hos", "Jl":"jol","Joel":"jol",
  "Am":"amo","Amos":"amo", "Ob":"oba","Obad":"oba", "Jon":"jon","Jonah":"jon",
  "Mi":"mic","Mic":"mic", "Na":"nam","Nah":"nam","Nahum":"nam", "Hab":"hab",
  "Zeph":"zep","Zep":"zep", "Hag":"hag", "Zech":"zec","Zec":"zec", "Mal":"mal",
  "Mt":"mat","Mat":"mat","Matt":"mat", "Mk":"mrk","Mar":"mrk","Mark":"mrk",
  "Lk":"luk","Lu":"luk","Luke":"luk", "Jn":"jhn","Jno":"jhn","John":"jhn",
  "Ac":"act","Acts":"act", "Ro":"rom","Rom":"rom","Rms":"rom",
  "1Co":"1co","1 Cor":"1co","1Cor":"1co","I Cor":"1co","I Corinthians":"1co",
  "2Co":"2co","2 Cor":"2co","2Cor":"2co","II Cor":"2co","II Corinthians":"2co",
  "Gal":"gal","Ga":"gal", "Eph":"eph","Ep":"eph", "Phil":"php","Php":"php","Phl":"php",
  "Col":"col", "1Th":"1th","1 Thess":"1th","1Thess":"1th","I Thess":"1th",
  "2Th":"2th","2 Thess":"2th","2Thess":"2th","II Thess":"2th",
  "1Ti":"1ti","1 Tim":"1ti","1Tim":"1ti","I Tim":"1ti",
  "2Ti":"2ti","2 Tim":"2ti","2Tim":"2ti","II Tim":"2ti",
  "Tit":"tit","Titus":"tit", "Phm":"phm","Philm":"phm",
  "Heb":"heb", "Jas":"jas","Jms":"jas","James":"jas",
  "1Pe":"1pe","1 Pet":"1pe","1Pet":"1pe","I Peter":"1pe",
  "2Pe":"2pe","2 Pet":"2pe","2Pet":"2pe","II Peter":"2pe",
  "1Jn":"1jn","1 John":"1jn","I John":"1jn",
  "2Jn":"2jn","2 John":"2jn","II John":"2jn",
  "3Jn":"3jn","3 John":"3jn","III John":"3jn",
  "Jud":"jud","Jude":"jud", "Rev":"rev","Rv":"rev","Apoc":"rev",
};

let _artRefRe: RegExp | null = null;
let _artRefMap: Map<string, string> | null = null;
let _artRefBookCount = -1;

export function artRefIndex(): { re: RegExp; map: Map<string, string> } {
  const books = aw().CODEX_DATA?.books || [];
  if (_artRefRe && _artRefMap && books.length === _artRefBookCount) return { re: _artRefRe, map: _artRefMap };
  const map = new Map<string, string>();
  for (const b of books) {
    map.set(b.name.toLowerCase(), b.id);
    const m = b.name.match(/^([1-3])\s+(.+)$/);
    if (m) {
      map.set((m[1] + " " + m[2]).toLowerCase(), b.id);
      map.set(("i".repeat(+(m[1] ?? "0")) + " " + m[2]).toLowerCase(), b.id);
    }
  }
  for (const [k, v] of Object.entries(ART_SHORT_BOOKS)) {
    if (!map.has(k.toLowerCase())) map.set(k.toLowerCase(), v);
  }
  const keys = [...map.keys()].sort((a, b) => b.length - a.length);
  const escaped = keys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  _artRefRe = new RegExp(
    "\\b(" + escaped.join("|") + ")\\.?\\s+(\\d{1,3})(?::(\\d{1,3})(?:[\\u2013-](\\d{1,3}))?)?\\b",
    "gi",
  );
  _artRefMap = map;
  _artRefBookCount = books.length;
  return { re: _artRefRe, map: _artRefMap };
}

// → [{type:"text",text} | {type:"ref",text,ref:{bookId,chapter,verse,endVerse,label}}]
export function artSplitOnRefs(text: unknown): RefSeg[] {
  const s = String(text == null ? "" : text);
  const { re, map } = artRefIndex();
  if (!map.size) return [{ type: "text", text: s }];
  const out: RefSeg[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  re.lastIndex = 0;
  while ((m = re.exec(s)) !== null) {
    const full = m[0] ?? "";
    const bookId = map.get((m[1] ?? "").toLowerCase());
    if (!bookId) continue;
    if (m.index > last) out.push({ type: "text", text: s.slice(last, m.index) });
    out.push({
      type: "ref",
      text: full,
      ref: {
        bookId,
        chapter: parseInt(m[2] ?? "", 10),
        verse: m[3] ? parseInt(m[3], 10) : null,
        endVerse: m[4] ? parseInt(m[4], 10) : null,
        label: full,
      },
    });
    last = m.index + full.length;
  }
  if (last < s.length) out.push({ type: "text", text: s.slice(last) });
  return out;
}
