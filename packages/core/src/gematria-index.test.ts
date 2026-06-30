import { describe, it, expect } from "vitest";
import { tokenize, buildGematriaIndex, findInIndex, indexStats } from "./gematria-index.js";

describe("tokenize", () => {
  it("splits on punctuation and drops 1-char tokens", () => {
    expect(tokenize("In the beginning, God.")).toEqual(["In", "the", "beginning", "God"]);
  });
});

describe("buildGematriaIndex", () => {
  const chapters = {
    "jhn.1.sblgnt": ["λόγος", "the eternal beginning"], // greek + english
    "gen.1.wlc": ["שלום"], // hebrew → 376
  };

  it("indexes greek isopsephy, english ordinal, and hebrew hechrachi", () => {
    const index = buildGematriaIndex(chapters);
    // λόγος = 373 (greek)
    expect(findInIndex(index, 373)).toEqual([{ ref: "jhn.1.1", word: "λόγος", system: "isopsephy" }]);
    // שלום = 376 (hebrew hechrachi) — first verse of gen.1.wlc
    expect(findInIndex(index, 376, { system: "hechrachi" })).toEqual([
      { ref: "gen.1.1", word: "שלום", system: "hechrachi" },
    ]);
    // "eternal" (en ordinal) indexed; "the" (<4 chars) is not
    const eternal = english_ordinal("eternal");
    expect(findInIndex(index, eternal).some((m) => m.word === "eternal")).toBe(true);
  });

  it("ignores English words shorter than 4 chars and skips non-arrays", () => {
    const index = buildGematriaIndex({ "x.1.t": ["the cat"], "bad.key": "nope" as unknown as string[] });
    // "the" and "cat" are both 3 chars → not indexed
    expect(indexStats(index)).toEqual({ values: 0, matches: 0 });
  });

  it("dedupes identical ref+word+system", () => {
    const index = buildGematriaIndex({ "jhn.1.a": ["λόγος λόγος"] });
    expect(findInIndex(index, 373)).toHaveLength(1);
  });
});

// local helper mirroring english.ordinal for the assertion above
function english_ordinal(s: string): number {
  let n = 0;
  for (const ch of s.toLowerCase()) {
    const c = ch.charCodeAt(0);
    if (c >= 97 && c <= 122) n += c - 96;
  }
  return n;
}
