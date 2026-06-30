import { describe, it, expect } from "vitest";
import { buildBibleRefRegex } from "./linkify.js";

function matches(text: string): string[] {
  const rx = buildBibleRefRegex();
  return [...text.matchAll(rx)].map((m) => m[0]);
}

describe("buildBibleRefRegex", () => {
  it("matches book + chapter[:verse[-range]]", () => {
    expect(matches("See John 3:16 and Genesis 1:1.")).toEqual(["John 3:16", "Genesis 1:1"]);
    expect(matches("compare 1 Corinthians 13:4-7")).toContain("1 Corinthians 13:4-7");
  });
  it("matches academic short forms", () => {
    expect(matches("cf. Rom 8:28 and Heb 1:3")).toEqual(["Rom 8:28", "Heb 1:3"]);
  });
  it("matches chapter-only references", () => {
    expect(matches("read Psalm 23 tonight")).toContain("Psalm 23");
  });
  it("does NOT match Talmud tractates or non-books", () => {
    expect(matches("Sanhedrin 98a says")).toEqual([]);
    expect(matches("Chapter 5 of the book")).toEqual([]);
  });
});
