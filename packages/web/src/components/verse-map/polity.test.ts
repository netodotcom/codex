import { describe, it, expect } from "vitest";
import {
  yearBounds,
  clampYear,
  majorTicks,
  minorTicks,
  boundaryTicks,
  activePolity,
  fmtMajor,
  type Polity,
} from "./polity.js";

const POLITIES: Polity[] = [
  { name: "Egypt (Old Kingdom)", from: -2686, to: -2181 },
  { name: "Roman Empire", from: -27, to: 476 },
];

describe("yearBounds", () => {
  it("pads to at least [-2500, 2030] and widens to the data", () => {
    expect(yearBounds([{ name: "x", from: -500, to: 500 }])).toEqual({ yMin: -2500, yMax: 2030 });
    expect(yearBounds(POLITIES)).toEqual({ yMin: -2686, yMax: 2030 });
  });
});

describe("clampYear", () => {
  it("clamps to the window", () => {
    expect(clampYear(9999, -2500, 2030)).toBe(2030);
    expect(clampYear(-9999, -2500, 2030)).toBe(-2500);
    expect(clampYear(0, -2500, 2030)).toBe(0);
  });
});

describe("ticks", () => {
  it("major ticks are round millennia within bounds", () => {
    expect(majorTicks(-2500, 2030)).toEqual([-2000, -1000, 0, 1000, 2000]);
  });
  it("minor ticks are 250-steps excluding majors", () => {
    const minor = minorTicks(-2500, 2030);
    expect(minor).toContain(-2250);
    expect(minor).toContain(250);
    expect(minor).not.toContain(0); // a major
  });
  it("boundary ticks are polity starts strictly inside the window", () => {
    expect(boundaryTicks(POLITIES, -2686, 2030)).toEqual([-27]); // -2686 == yMin → excluded
  });
});

describe("activePolity", () => {
  it("finds the polity containing the year", () => {
    expect(activePolity(POLITIES, 100)?.name).toBe("Roman Empire");
  });
  it("falls back to the nearest polity when none contains the year", () => {
    expect(activePolity(POLITIES, -2400)?.name).toBe("Egypt (Old Kingdom)");
  });
  it("returns null for an empty list", () => {
    expect(activePolity([], 0)).toBeNull();
  });
});

describe("fmtMajor", () => {
  it("formats millennia with BC suffix", () => {
    expect(fmtMajor(0)).toBe("0");
    expect(fmtMajor(-2000)).toBe("2K BC");
    expect(fmtMajor(1000)).toBe("1K");
  });
});
