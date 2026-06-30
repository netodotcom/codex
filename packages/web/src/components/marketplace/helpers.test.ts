// marketplace — ground-truth tests for pure helpers.
import { describe, it, expect } from "vitest";
import { fmtSize, fmtDate, typeBadge, CategoryFromIndex } from "./helpers.js";

describe("fmtSize", () => {
  it("returns — for null", () => expect(fmtSize(null)).toBe("—"));
  it("returns — for undefined", () => expect(fmtSize(undefined)).toBe("—"));
  it("returns 0 KB for 0", () => expect(fmtSize(0)).toBe("0 KB"));
  it("returns n KB for values under 1024", () => expect(fmtSize(512)).toBe("512 KB"));
  it("returns MB for values 1024 and above", () => expect(fmtSize(1024)).toBe("1.0 MB"));
  it("returns fractional MB", () => expect(fmtSize(2048)).toBe("2.0 MB"));
  it("returns one decimal", () => expect(fmtSize(1536)).toBe("1.5 MB"));
});

describe("fmtDate", () => {
  it("returns — for null", () => expect(fmtDate(null)).toBe("—"));
  it("returns — for undefined", () => expect(fmtDate(undefined)).toBe("—"));
  it("returns a locale string for a valid ISO date", () => {
    const result = fmtDate("2024-01-15");
    expect(typeof result).toBe("string");
    expect(result).not.toBe("—");
  });
});

describe("typeBadge", () => {
  it("uppercases the type", () => expect(typeBadge("lexicon")).toBe("LEXICON"));
  it("replaces hyphens with spaces", () => expect(typeBadge("cross-reference")).toBe("CROSS REFERENCE"));
  it("defaults to MODULE for null", () => expect(typeBadge(null)).toBe("MODULE"));
  it("defaults to MODULE for undefined", () => expect(typeBadge(undefined)).toBe("MODULE"));
  it("defaults to MODULE for empty string", () => expect(typeBadge("")).toBe("MODULE"));
});

describe("CategoryFromIndex", () => {
  it("returns the explicit category if present", () =>
    expect(CategoryFromIndex({ category: "maps", type: "lexicon" })).toBe("maps"));
  it("maps lexicon type", () => expect(CategoryFromIndex({ type: "lexicon" })).toBe("lexicons"));
  it("maps concordance type", () => expect(CategoryFromIndex({ type: "concordance" })).toBe("lexicons"));
  it("maps cross-reference type", () => expect(CategoryFromIndex({ type: "cross-reference" })).toBe("cross-refs"));
  it("maps commentary type", () => expect(CategoryFromIndex({ type: "commentary" })).toBe("commentaries"));
  it("maps reading-plan type", () => expect(CategoryFromIndex({ type: "reading-plan" })).toBe("plans"));
  it("maps dictionary type", () => expect(CategoryFromIndex({ type: "dictionary" })).toBe("dictionaries"));
  it("maps map-overlay type", () => expect(CategoryFromIndex({ type: "map-overlay" })).toBe("maps"));
  it("maps timeline type", () => expect(CategoryFromIndex({ type: "timeline" })).toBe("timelines"));
  it("returns other for unknown type", () => expect(CategoryFromIndex({ type: "exotic" })).toBe("other"));
  it("returns other for no type", () => expect(CategoryFromIndex({})).toBe("other"));
});
