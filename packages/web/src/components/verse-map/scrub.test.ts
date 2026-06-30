import { describe, it, expect } from "vitest";
import { scrubList, scrubBounds, activeIndex, pct } from "./scrub.js";
import type { Polity } from "./polity.js";

const RAW: Polity[] = [
  { name: "Rome", from: -27, to: 476 },
  { name: "Egypt", from: -3100, to: -332 },
  { name: "bad", from: 500, to: 500 }, // to == from → dropped
  { name: "", from: -100, to: 100 }, // empty name → dropped
];

describe("scrubList", () => {
  it("drops invalid polities and sorts by start year", () => {
    const list = scrubList(RAW);
    expect(list.map((p) => p.name)).toEqual(["Egypt", "Rome"]);
  });
});

describe("scrubBounds", () => {
  it("spans the list, with defaults for an empty list", () => {
    expect(scrubBounds(scrubList(RAW))).toEqual({ yMin: -3100, yMax: 476 });
    expect(scrubBounds([])).toEqual({ yMin: -2000, yMax: 2030 });
  });
});

describe("activeIndex", () => {
  const list = scrubList(RAW); // [Egypt, Rome]
  it("finds the containing segment", () => {
    expect(activeIndex(list, 100)).toBe(1); // Rome
    expect(activeIndex(list, -1000)).toBe(0); // Egypt
  });
  it("falls back to the nearest segment", () => {
    expect(activeIndex(list, 3000)).toBe(1); // closest to Rome's end
  });
  it("is -1 for an empty list", () => {
    expect(activeIndex([], 0)).toBe(-1);
  });
});

describe("pct", () => {
  it("maps a year to a 0–100 position", () => {
    expect(pct(0, 0, 100)).toBe(0);
    expect(pct(50, 0, 100)).toBe(50);
    expect(pct(100, 0, 100)).toBe(100);
  });
});
