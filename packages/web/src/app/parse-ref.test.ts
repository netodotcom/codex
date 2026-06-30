import { describe, it, expect } from "vitest";
import { parseRef, type RefBook } from "./parse-ref.js";

const books: RefBook[] = [
  { id: "gen", name: "Genesis", chapters: 50 },
  { id: "jhn", name: "John", chapters: 21 },
  { id: "1jn", name: "1 John", chapters: 5 },
  { id: "psa", name: "Psalms", chapters: 150 },
  { id: "sng", name: "Song of Songs", chapters: 8 },
];

describe("parseRef (ground truth)", () => {
  it("parses book chapter:verse", () => {
    expect(parseRef("Genesis 1:1", books)).toEqual({ bookId: "gen", chapter: 1, verse: 1 });
  });
  it("defaults the verse to 1 when omitted", () => {
    expect(parseRef("John 3", books)).toEqual({ bookId: "jhn", chapter: 3, verse: 1 });
  });
  it("handles a numeric book prefix", () => {
    expect(parseRef("1 John 2:5", books)).toEqual({ bookId: "1jn", chapter: 2, verse: 5 });
  });
  it("clamps the chapter to the book's max", () => {
    expect(parseRef("Genesis 99:1", books)).toEqual({ bookId: "gen", chapter: 50, verse: 1 });
  });
  it("matches a multi-word book name", () => {
    expect(parseRef("Song of Songs 2", books)).toEqual({ bookId: "sng", chapter: 2, verse: 1 });
  });
  it("matches a prefix abbreviation", () => {
    expect(parseRef("Gen 5", books)).toEqual({ bookId: "gen", chapter: 5, verse: 1 });
  });
  it("returns null for an unknown book or empty input", () => {
    expect(parseRef("Zephaniah 1", books)).toBeNull();
    expect(parseRef("", books)).toBeNull();
  });
});
