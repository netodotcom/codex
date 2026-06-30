// @vitest-environment jsdom
// Pure helpers — lookup, canonRef, alignmentFor — tested in jsdom (the
// module-level ensureLoaded() accesses window so we run under jsdom, but
// we control _lex directly so no real module loading happens).
import { describe, it, expect, beforeEach } from "vitest";
import { lookup, canonRef, alignmentFor, _lex } from "./helpers.js";
import type { StrongsEntry, StrongsLexicon, AlignmentModule } from "./strongs-window.js";

const SAMPLE_ENTRY: StrongsEntry = {
  word: "אֱלֹהִים",
  translit: "elohim",
  gloss: "God, gods",
  pron: "el-o-heem'",
  pos: "noun",
  def: "The supreme God.",
  usage: 2606,
};

const SAMPLE_GREEK: StrongsEntry = {
  word: "θεός",
  translit: "theos",
  gloss: "God",
  usage: 1317,
};

beforeEach(() => {
  // Reset shared module state between tests.
  _lex.hebrew = null;
  _lex.greek = null;
  _lex.alignment = null;
});

// ── lookup ─────────────────────────────────────────────────────────────────
describe("lookup", () => {
  it("returns null when _lex is empty", () => {
    expect(lookup("H430")).toBeNull();
    expect(lookup("G2316")).toBeNull();
  });

  it("returns null for empty or non-string input", () => {
    expect(lookup("")).toBeNull();
  });

  it("returns null for keys not matching /^[HG]\\d+$/", () => {
    _lex.hebrew = { entries: { H430: SAMPLE_ENTRY } };
    expect(lookup("XYZ")).toBeNull();
    expect(lookup("H")).toBeNull();
    expect(lookup("430")).toBeNull();
    expect(lookup("h430abc")).toBeNull();
  });

  it("looks up a Hebrew entry (case-insensitive key)", () => {
    _lex.hebrew = { entries: { H430: SAMPLE_ENTRY } } as StrongsLexicon;
    expect(lookup("H430")).toEqual(SAMPLE_ENTRY);
    expect(lookup("h430")).toEqual(SAMPLE_ENTRY); // normalised to uppercase
  });

  it("looks up a Greek entry", () => {
    _lex.greek = { entries: { G2316: SAMPLE_GREEK } } as StrongsLexicon;
    expect(lookup("G2316")).toEqual(SAMPLE_GREEK);
  });

  it("returns null for an entry missing from the lexicon", () => {
    _lex.hebrew = { entries: {} };
    expect(lookup("H1")).toBeNull();
  });
});

// ── canonRef ───────────────────────────────────────────────────────────────
describe("canonRef", () => {
  it("lowercases and trims a plain string ref", () => {
    expect(canonRef("JOHN.3.16")).toBe("john.3.16");
    expect(canonRef("  john.3.16  ")).toBe("john.3.16");
  });

  it("builds a ref from an object with book + chapter + verse", () => {
    expect(canonRef({ book: "john", chapter: 3, verse: 16 })).toBe("john.3.16");
  });

  it("prefers bookId over book", () => {
    expect(canonRef({ bookId: "jhn", book: "john", chapter: 3, verse: 16 })).toBe("jhn.3.16");
  });

  it("strips spaces from book names", () => {
    expect(canonRef({ book: "1 john", chapter: 1, verse: 1 })).toBe("1john.1.1");
  });

  it("uses third-argument pair when refOrParts is not string/object", () => {
    // This overload exists in the legacy for completeness; never called in practice.
    expect(canonRef(null, 1, 1)).toBe(".1.1");
    expect(canonRef(undefined, 5, 10)).toBe(".5.10");
  });

  it("returns null for unrecognised input", () => {
    expect(canonRef(null)).toBeNull();
    expect(canonRef(undefined)).toBeNull();
  });
});

// ── alignmentFor ───────────────────────────────────────────────────────────
describe("alignmentFor", () => {
  it("returns null when alignment is not loaded", () => {
    expect(alignmentFor("gen.1.1")).toBeNull();
  });

  it("returns null for a null/undefined ref", () => {
    _lex.alignment = { verses: { "gen.1.1": [{ en: "In", strongs: "H430" }] } } as AlignmentModule;
    expect(alignmentFor(null)).toBeNull();
    expect(alignmentFor(undefined)).toBeNull();
  });

  it("returns the token array for a known ref", () => {
    const tokens = [{ en: "In", strongs: "H430" }, { en: "the beginning", strongs: "H7225" }];
    _lex.alignment = { verses: { "gen.1.1": tokens } } as AlignmentModule;
    expect(alignmentFor("gen.1.1")).toEqual(tokens);
  });

  it("returns null for a ref not in the alignment", () => {
    _lex.alignment = { verses: { "gen.1.1": [{ en: "In" }] } } as AlignmentModule;
    expect(alignmentFor("rev.22.21")).toBeNull();
  });
});
