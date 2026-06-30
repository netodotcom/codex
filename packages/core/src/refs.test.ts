import { describe, it, expect } from "vitest";
import { parse, firstRef, codexUrl, bibleApiUrl, BOOKS } from "./refs.js";

// Behavior locked from the original extension/ref-parser.js so the port is
// faithful and the extension can switch to @codex/core without regressions.

describe("parse", () => {
  it("returns [] for empty / non-string input", () => {
    expect(parse("")).toEqual([]);
    // @ts-expect-error — guarding runtime callers that pass non-strings
    expect(parse(null)).toEqual([]);
    // @ts-expect-error
    expect(parse(undefined)).toEqual([]);
    expect(parse("no scripture here, just prose")).toEqual([]);
  });

  it("parses a single full reference with a verse range", () => {
    const refs = parse("see John 3:16-18");
    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({
      book: "John",
      chapter: 3,
      verse: 16,
      endVerse: 18,
      range: "16-18",
      normalized: "john.3.16-18",
    });
    expect(refs[0]?.rawText).toBe("John 3:16-18");
  });

  it("parses a chapter-only reference (no verse)", () => {
    const refs = parse("Ps 23");
    expect(refs).toHaveLength(1);
    expect(refs[0]).toMatchObject({
      book: "Psalms",
      chapter: 23,
      verse: null,
      endVerse: null,
      range: null,
      normalized: "psalms.23",
    });
  });

  it("parses a single verse (no range)", () => {
    expect(parse("Gen 1:1")[0]).toMatchObject({
      book: "Genesis",
      chapter: 1,
      verse: 1,
      endVerse: null,
      range: "1",
      normalized: "genesis.1.1",
    });
  });

  it("resolves numbered books via abbreviations", () => {
    expect(parse("1 Cor 13:4-7")[0]).toMatchObject({
      book: "1 Corinthians",
      normalized: "1corinthians.13.4-7",
    });
  });

  it("resolves leading roman numerals (II Cor)", () => {
    expect(parse("II Cor 5:17")[0]).toMatchObject({
      book: "2 Corinthians",
      normalized: "2corinthians.5.17",
    });
  });

  it("resolves 3-letter aliases (jhn → John)", () => {
    expect(parse("jhn 3:16")[0]).toMatchObject({
      book: "John",
      normalized: "john.3.16",
    });
  });

  it("accepts an en-dash as the range separator", () => {
    expect(parse("John 3:16–18")[0]).toMatchObject({
      verse: 16,
      endVerse: 18,
      range: "16-18",
    });
  });

  it("finds multiple references in one block of text", () => {
    const refs = parse("compare John 3:16-18 and 1 Cor 13:4-7");
    expect(refs.map((r) => r.normalized)).toEqual([
      "john.3.16-18",
      "1corinthians.13.4-7",
    ]);
  });

  it("captures a comma-separated tail without expanding it", () => {
    const ref = parse("Gen 1:1, 1:5, 2:3")[0];
    expect(ref).toMatchObject({ book: "Genesis", chapter: 1, verse: 1 });
    expect(ref?.tail).toBe(", 1:5, 2:3");
  });
});

describe("firstRef", () => {
  it("returns the first reference or null", () => {
    expect(firstRef("nothing here")).toBeNull();
    expect(firstRef("then John 1:1")?.normalized).toBe("john.1.1");
  });
});

describe("codexUrl", () => {
  it("builds a codex deep link from a ref or a normalized string", () => {
    const ref = firstRef("John 3:16");
    expect(codexUrl(ref)).toBe("https://codex.app/?ref=john.3.16");
    expect(codexUrl("genesis.1.1")).toBe("https://codex.app/?ref=genesis.1.1");
    expect(codexUrl(null)).toBe("https://codex.app/");
  });
});

describe("bibleApiUrl", () => {
  it("maps a normalized ref to a bible-api.com URL", () => {
    expect(bibleApiUrl("john.3.16-18")).toBe("https://bible-api.com/john+3:16-18");
    expect(bibleApiUrl("psalms.23")).toBe("https://bible-api.com/psalms+23");
    expect(bibleApiUrl(firstRef("Gen 1:1"))).toBe("https://bible-api.com/genesis+1:1");
    expect(bibleApiUrl(null)).toBeNull();
  });
});

describe("BOOKS", () => {
  it("exposes the canonical registry (66 + deuterocanon)", () => {
    expect(BOOKS.length).toBe(73);
    expect(BOOKS[0]).toMatchObject({ name: "Genesis", slug: "genesis" });
  });
});
