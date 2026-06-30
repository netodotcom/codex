// @vitest-environment jsdom
// Ground truth captured by running a faithful copy of the legacy artSplitOnRefs
// in node (no CODEX_DATA → refs resolve via the ART_SHORT_BOOKS table only).
// Faithful quirk preserved: the full name "Genesis" does NOT resolve without
// CODEX_DATA.books — only the abbreviation table entries ("Gen", "Ps", …) do.
import { describe, it, expect } from "vitest";
import { artSplitOnRefs } from "./refs.js";

describe("artSplitOnRefs (ground truth, ART_SHORT_BOOKS only)", () => {
  it("splits a single chapter:verse ref and leaves an unlisted full name as text", () => {
    expect(artSplitOnRefs("See John 1:1 and Genesis 1:26-27 here.")).toEqual([
      { type: "text", text: "See " },
      { type: "ref", text: "John 1:1", ref: { bookId: "jhn", chapter: 1, verse: 1, endVerse: null, label: "John 1:1" } },
      { type: "text", text: " and Genesis 1:26-27 here." },
    ]);
  });

  it("returns the whole string as text when there are no refs", () => {
    expect(artSplitOnRefs("no refs at all")).toEqual([{ type: "text", text: "no refs at all" }]);
  });

  it("resolves numbered-book and short abbreviations", () => {
    expect(artSplitOnRefs("Compare 1 Cor 13:4 with Ps 23.")).toEqual([
      { type: "text", text: "Compare " },
      { type: "ref", text: "1 Cor 13:4", ref: { bookId: "1co", chapter: 13, verse: 4, endVerse: null, label: "1 Cor 13:4" } },
      { type: "text", text: " with " },
      { type: "ref", text: "Ps 23", ref: { bookId: "psa", chapter: 23, verse: null, endVerse: null, label: "Ps 23" } },
      { type: "text", text: "." },
    ]);
  });

  it("resolves a chapter-only ref (no verse)", () => {
    expect(artSplitOnRefs("Read John 3 today.")).toEqual([
      { type: "text", text: "Read " },
      { type: "ref", text: "John 3", ref: { bookId: "jhn", chapter: 3, verse: null, endVerse: null, label: "John 3" } },
      { type: "text", text: " today." },
    ]);
  });

  it("returns no segments for null/undefined/empty (faithful: empty string yields [])", () => {
    expect(artSplitOnRefs(null)).toEqual([]);
    expect(artSplitOnRefs(undefined)).toEqual([]);
    expect(artSplitOnRefs("")).toEqual([]);
  });
});
