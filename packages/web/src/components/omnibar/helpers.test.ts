// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from "vitest";
import {
  omniEditDist,
  omniBookKeys,
  omniFuzzyRef,
  omniFreqScore,
  omniLooseRows,
  omniCatalogRows,
  omniIndexRows,
  type FreqMap,
} from "./helpers.js";
import type { CatalogRow } from "./data.js";
import type { BookEntry } from "./omnibar-window.js";

const BOOKS: BookEntry[] = [
  { id: "gen", name: "Genesis", chapters: 50 },
  { id: "psa", name: "Psalms", chapters: 150 },
  { id: "jhn", name: "John", chapters: 21 },
  { id: "jon", name: "Jonah", chapters: 4 },
  { id: "exo", name: "Exodus", chapters: 40 },
  { id: "2sa", name: "II Samuel", chapters: 24 },
];

function setBooks(books: BookEntry[] | null): void {
  (window as unknown as { CODEX_DATA?: { books?: BookEntry[] } }).CODEX_DATA = books ? { books } : {};
}

describe("omniEditDist (Damerau-Levenshtein, ground truth)", () => {
  it("counts a transposition as one edit ('Jhon' → 'john')", () => {
    expect(omniEditDist("jhon", "john", 2)).toBe(1);
  });
  it("counts a deletion as one edit ('jhon' → 'jon')", () => {
    expect(omniEditDist("jhon", "jon", 2)).toBe(1);
  });
  it("is zero for an exact match", () => {
    expect(omniEditDist("abc", "abc", 2)).toBe(0);
  });
  it("computes the classic kitten→sitting distance", () => {
    expect(omniEditDist("kitten", "sitting", 3)).toBe(3);
  });
  it("early-exits to max+1 when the length gap alone exceeds max", () => {
    expect(omniEditDist("ab", "abcde", 2)).toBe(3);
  });
});

describe("omniBookKeys (ground truth)", () => {
  it("expands roman-numeral books and penalises the bare id", () => {
    expect(omniBookKeys({ id: "2sa", name: "II Samuel" })).toEqual([
      ["iisamuel", 0],
      ["2samuel", 0],
      ["samuel", 0],
      ["2sa", 0.5],
    ]);
  });
  it("keeps the name at 0 and the id at 0.5 for a plain book", () => {
    expect(omniBookKeys({ id: "jhn", name: "John" })).toEqual([
      ["john", 0],
      ["jhn", 0.5],
    ]);
  });
});

describe("omniFuzzyRef (ground truth, reads window.CODEX_DATA.books)", () => {
  beforeEach(() => setBooks(BOOKS));

  it("forgives a typo + space-for-colon: 'Jhon 3 16' → John 3:16 (dist 1)", () => {
    expect(omniFuzzyRef("Jhon 3 16")).toEqual({
      bookId: "jhn", bookName: "John", chapter: 3, v1: 16, dist: 1, refStr: "John 3:16",
    });
  });
  it("forgives a stray space: 'psalm s23' → Psalms 23 (dist 0)", () => {
    expect(omniFuzzyRef("psalm s23")).toMatchObject({ bookName: "Psalms", chapter: 23, v1: null, dist: 0, refStr: "Psalms 23" });
  });
  it("reads a natural phrase, book only: 'go to psalms' → Psalms 1", () => {
    expect(omniFuzzyRef("go to psalms")).toMatchObject({ bookName: "Psalms", chapter: 1, v1: null, refStr: "Psalms 1" });
  });
  it("parses an exact ref at dist 0: 'John 3:16'", () => {
    expect(omniFuzzyRef("John 3:16")).toMatchObject({ bookName: "John", chapter: 3, v1: 16, dist: 0 });
  });
  it("clamps the chapter to the book's length: 'genesis 999' → Genesis 50", () => {
    expect(omniFuzzyRef("genesis 999")).toMatchObject({ bookName: "Genesis", chapter: 50, refStr: "Genesis 50" });
  });
  it("forgives a bare book-name typo: 'jhon' → John 1 (dist 1)", () => {
    expect(omniFuzzyRef("jhon")).toMatchObject({ bookName: "John", chapter: 1, v1: null, dist: 1, refStr: "John 1" });
  });
  it("returns null for noise, the '/' palette, and when no books are loaded", () => {
    expect(omniFuzzyRef("xyz")).toBeNull();
    expect(omniFuzzyRef("/foo")).toBeNull();
    setBooks(null);
    expect(omniFuzzyRef("John 3:16")).toBeNull();
  });
});

describe("omniFreqScore (ground truth)", () => {
  it("scores a fresh entry at ~n and an ancient entry at ~0", () => {
    const now = Date.now();
    const map: FreqMap = { a: { n: 3, last: now }, old: { n: 5, last: 0 } };
    expect(omniFreqScore(map, ["a"])).toBeCloseTo(3, 5);
    expect(omniFreqScore(map, ["old"])).toBeCloseTo(0, 5);
  });
  it("is zero for empty/unknown ids", () => {
    expect(omniFreqScore({}, [])).toBe(0);
    expect(omniFreqScore({}, ["z"])).toBe(0);
  });
});

describe("omniLooseRows (every meaningful word must hit the haystack)", () => {
  const cat: CatalogRow[] = [
    { id: "verb-map", icon: "◎", title: "MAP", hay: "verb map geography places atlas where", score: 0 },
    { id: "cmd-theme", icon: "◐", title: "Theme", hay: "cmd theme dark mode light night day", score: 0 },
  ];
  it("'open the map' surfaces only the map row (stop-words dropped)", () => {
    expect(omniLooseRows("open the map", cat).map((r) => r.id)).toEqual(["verb-map"]);
  });
  it("'turn on dark mode' surfaces only the theme row", () => {
    expect(omniLooseRows("turn on dark mode", cat).map((r) => r.id)).toEqual(["cmd-theme"]);
  });
  it("returns nothing when every word is a stop-word or too short", () => {
    expect(omniLooseRows("the a to", cat)).toEqual([]);
  });
});

describe("omniCatalogRows + omniIndexRows", () => {
  beforeEach(() => {
    try { localStorage.clear(); } catch {}
  });
  it("builds verb / panel / command / loom rows, each with a hay + numeric score", () => {
    const rows = omniCatalogRows(() => {});
    const ids = new Set(rows.map((r) => r.id));
    expect(ids.has("verb-map")).toBe(true);
    expect(ids.has("panel-trans")).toBe(true);
    expect(ids.has("cmd-ops")).toBe(true);
    expect(ids.has("loom")).toBe(true);
    for (const r of rows) {
      expect(typeof r.hay).toBe("string");
      expect(typeof r.score).toBe("number");
    }
  });
  it("prefix-matches panel labels AND command aliases into the strong bucket", () => {
    const { strong, weak } = omniIndexRows("trans");
    const ids = strong.map((r) => r.id);
    expect(ids).toContain("panel-trans"); // TRANSLATIONS label
    expect(ids).toContain("cmd-study"); // study has the 'translations' alias
    expect(weak).toEqual([]);
  });
});
