import { describe, it, expect } from "vitest";
import { ordinalWord, humanAgo } from "./format.js";
import { gemNormalize, gemValueFor, computeGematriaCalc } from "./gem-chars.js";

describe("ordinalWord", () => {
  it("words the first ten, then falls back to Nth", () => {
    expect(ordinalWord(0)).toBe("zeroth");
    expect(ordinalWord(3)).toBe("third");
    expect(ordinalWord(10)).toBe("tenth");
    expect(ordinalWord(11)).toBe("11th");
  });
});

describe("humanAgo", () => {
  const now = 1_700_000_000_000;
  it("buckets recent timestamps", () => {
    expect(humanAgo(0, now)).toBe("");
    expect(humanAgo(now - 30_000, now)).toBe("just now");
    expect(humanAgo(now - 120_000, now)).toBe("2m ago");
    expect(humanAgo(now - 2 * 3600_000, now)).toBe("2h ago");
    expect(humanAgo(now - 2 * 86400_000, now)).toBe("2d ago");
  });
  it("formats older timestamps as a date", () => {
    expect(humanAgo(now - 30 * 86400_000, now)).toMatch(/^\d{4}·\d{2}·\d{2}$/);
  });
});

describe("gem-chars", () => {
  it("normalizes away diacritics", () => {
    expect(gemNormalize("ό")).toBe("ο");
  });
  it("resolves Greek and Hebrew glyph values + script", () => {
    expect(gemValueFor("α")).toEqual({ v: 1, script: "Greek" });
    expect(gemValueFor("λ")).toEqual({ v: 30, script: "Greek" });
    expect(gemValueFor("ό")).toEqual({ v: 70, script: "Greek" }); // accented omicron → 70
    expect(gemValueFor("א")).toEqual({ v: 1, script: "Hebrew" });
    expect(gemValueFor("ך")).toEqual({ v: 20, script: "Hebrew" }); // final kaf
  });
  it("returns null for non-gematria characters", () => {
    expect(gemValueFor("z")).toBeNull();
    expect(gemValueFor("")).toBeNull();
  });
});

describe("computeGematriaCalc", () => {
  it("sums Greek isopsephy with breakdown, ordinal and digital root", () => {
    const r = computeGematriaCalc("λόγος"); // 30+70+3+70+200 = 373
    expect(r.sum).toBe(373);
    expect(r.script).toBe("Greek isopsephy");
    expect(r.reduced).toBe(4); // 3+7+3=13 → 1+3=4
    expect(r.breakdown.map((b) => b.v)).toEqual([30, 70, 3, 70, 200]);
  });
  it("detects Hebrew and ignores non-letters", () => {
    const r = computeGematriaCalc("אהבה!"); // 1+5+2+5 = 13
    expect(r.sum).toBe(13);
    expect(r.script).toBe("Mispar Hechrachi");
    expect(r.breakdown).toHaveLength(4);
  });
  it("returns a null script for empty/plain input", () => {
    expect(computeGematriaCalc("hello").script).toBeNull();
  });
});
