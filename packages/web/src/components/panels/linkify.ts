// panels — Bible-reference detection regex (Backlog 4.1). Pure; extracted from
// panels.jsx (_BIBLE_BOOK_RX). Builds from @codex/core's canonical book list so
// Talmud tractates ("Sanhedrin 98a") don't false-match, plus Arabic-numeral and
// academic short-form aliases.
import { books as coreBooks, type Book } from "@codex/core/data";

const ALIASES = [
  "Gen", "Ex", "Exod", "Lev", "Num", "Deut", "Josh", "Judg", "Ruth",
  "1 Sam", "2 Sam", "1 Kgs", "2 Kgs", "1 Chr", "2 Chr", "Neh", "Esth", "Ps", "Psa", "Psalm",
  "Prov", "Eccl", "Song", "Isa", "Jer", "Lam", "Ezek", "Dan", "Hos", "Joel", "Amos", "Obad",
  "Jonah", "Mic", "Nah", "Hab", "Zeph", "Hag", "Zech", "Mal",
  "Matt", "Mt", "Mk", "Lk", "Jn", "Acts", "Rom", "1 Cor", "2 Cor", "Gal", "Eph", "Phil",
  "Col", "1 Thess", "2 Thess", "1 Tim", "2 Tim", "Tit", "Phlm", "Heb", "Jas", "Jms",
  "1 Pet", "2 Pet", "1 Jn", "2 Jn", "3 Jn", "Jude", "Rev",
];

const ROMAN: Record<string, string> = { I: "1", II: "2", III: "3" };

/** Build a global regex that matches "<Book> <chapter>[:verse[-range]]". */
export function buildBibleRefRegex(bookList: Book[] = coreBooks): RegExp {
  const canonical = bookList.map((b) => b.name);
  const arabicMirrors = canonical
    .map((n) => n.replace(/^(I{1,3})\s+/, (_m, r: string) => (ROMAN[r] || r) + " "))
    .filter((n) => !canonical.includes(n));
  const all = [...new Set([...canonical, ...arabicMirrors, ...ALIASES])]
    .sort((a, b) => b.length - a.length)
    .map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`\\b(${all.join("|")})\\s+(\\d+)(?::(\\d+)(?:[-–]\\d+)?)?(?!\\d)`, "g");
}
