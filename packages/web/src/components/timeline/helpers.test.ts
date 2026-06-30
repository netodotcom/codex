// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { yearLabel, parseScriptureRef, eventMatchesPassage, sigOf, pickTickInterval, clamp, easeInOut } from "./helpers.js";
import type { TimelineEvent } from "./data.js";

const ev = (scripture: string[], extra: Partial<TimelineEvent> = {}): TimelineEvent => ({
  id: "x",
  year: 0,
  era: "primeval",
  category: "narrative",
  title: "t",
  scripture,
  ...extra,
});

describe("yearLabel (ground truth)", () => {
  it("labels BC / the seam / AD", () => {
    expect(yearLabel(-586)).toBe("586 BC");
    expect(yearLabel(0)).toBe("1 BC/AD");
    expect(yearLabel(30)).toBe("AD 30");
  });
});

describe("parseScriptureRef (ground truth, fallback names)", () => {
  it("parses book.chapter.verse", () => {
    expect(parseScriptureRef("gen.1.1")).toMatchObject({ bookId: "gen", chapter: 1, verse: 1, display: "Genesis 1:1" });
  });
  it("parses book.chapter only", () => {
    expect(parseScriptureRef("mat.5")).toMatchObject({ bookId: "mat", chapter: 5, verse: null, display: "Matthew 5" });
  });
  it("takes the head of a range", () => {
    expect(parseScriptureRef("gen.1.1-2.3")).toMatchObject({ chapter: 1, verse: 1, display: "Genesis 1:1" });
  });
  it("returns null for empty", () => {
    expect(parseScriptureRef("")).toBeNull();
  });
});

describe("eventMatchesPassage (ground truth)", () => {
  it("matches an exact chapter, rejects a wrong one", () => {
    expect(eventMatchesPassage(ev(["gen.1.1"]), "gen", 1)).toBe(true);
    expect(eventMatchesPassage(ev(["gen.1.1"]), "gen", 2)).toBe(false);
  });
  it("matches inside a chapter range", () => {
    expect(eventMatchesPassage(ev(["gen.1.1-2.3"]), "gen", 2)).toBe(true);
  });
  it("matches the book alone when chapter is null", () => {
    expect(eventMatchesPassage(ev(["mat.5"]), "mat", null)).toBe(true);
  });
  it("rejects a different book", () => {
    expect(eventMatchesPassage(ev(["jhn.1"]), "gen", 1)).toBe(false);
  });
});

describe("sigOf (ground truth)", () => {
  it("floors at 1 and caps at 5", () => {
    expect(sigOf(ev([]))).toBe(1);
    expect(sigOf(ev(Array(10).fill("x")))).toBe(5);
  });
  it("weights refs/people/places/range", () => {
    expect(sigOf(ev(["a", "b"], { people: ["x", "y", "z"], places: ["p"], year_range: [100, 200] }))).toBeCloseTo(4.6, 5);
  });
});

describe("pickTickInterval / clamp / easeInOut (ground truth)", () => {
  it("picks a sane tick interval for the zoom", () => {
    expect(pickTickInterval(4000, 0.05)).toBe(2000);
    expect(pickTickInterval(200, 2)).toBe(50);
    expect(pickTickInterval(10, 50)).toBe(2);
  });
  it("clamps", () => {
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(50, 0, 10)).toBe(10);
    expect(clamp(5, 0, 10)).toBe(5);
  });
  it("eases symmetrically", () => {
    expect(Number(easeInOut(0.25).toFixed(4))).toBe(0.0625);
    expect(easeInOut(0.5)).toBe(0.5);
    expect(Number(easeInOut(0.75).toFixed(4))).toBe(0.9375);
  });
});
