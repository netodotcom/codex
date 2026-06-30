import { describe, it, expect } from "vitest";
import { parseRefKey } from "./helpers.js";

// parseRefKey is pure; ground truth captured from the original passage-guide.jsx.
describe("parseRefKey (ground truth)", () => {
  it("parses book.chapter.verse", () => {
    expect(parseRefKey("jhn.3.16")).toEqual({ bookId: "jhn", chapter: 3, verse: 16 });
  });
  it("parses book.chapter with a null verse", () => {
    expect(parseRefKey("gen.1")).toEqual({ bookId: "gen", chapter: 1, verse: null });
  });
  it("lowercases the book id", () => {
    expect(parseRefKey("GEN.2.4")).toEqual({ bookId: "gen", chapter: 2, verse: 4 });
  });
  it("returns null for a single segment", () => {
    expect(parseRefKey("gen")).toBeNull();
  });
  it("returns null for a non-string", () => {
    expect(parseRefKey(42)).toBeNull();
  });
  it("returns null when the chapter is not numeric", () => {
    expect(parseRefKey("gen.x.1")).toBeNull();
  });
});
