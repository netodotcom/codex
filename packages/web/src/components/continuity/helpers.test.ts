import { describe, it, expect } from "vitest";
import { safe, asciiBar, isoStamp, pctToNext, FALLBACK_DOMAINS, STEP_KIND_KEY, STEP_KIND_EN } from "./helpers.js";

describe("safe (ground truth)", () => {
  it("returns the value when present", () => {
    expect(safe(() => 5, 0)).toBe(5);
    expect(safe(() => "ok", "x")).toBe("ok");
  });
  it("returns the default on null/undefined (but NOT on 0 / '' / false)", () => {
    expect(safe(() => null, 7)).toBe(7);
    expect(safe(() => undefined, "d")).toBe("d");
    expect(safe(() => 0, 9)).toBe(0); // 0 is a real value, passes through
    expect(safe(() => "", "d")).toBe("");
    expect(safe(() => false, true)).toBe(false);
  });
  it("returns the default when the function throws", () => {
    expect(
      safe(() => {
        throw new Error("boom");
      }, "fallback"),
    ).toBe("fallback");
  });
});

describe("asciiBar (ground truth)", () => {
  it("renders an empty and a full bar", () => {
    expect(asciiBar(0, 5)).toBe("░░░░░");
    expect(asciiBar(100, 5)).toBe("▓▓▓▓▓");
  });
  it("rounds the fill (half-up) and defaults to 5 cells", () => {
    expect(asciiBar(50, 5)).toBe("▓▓▓░░"); // round(2.5) === 3
    expect(asciiBar(78, 5)).toBe("▓▓▓▓░");
    expect(asciiBar(20, 5)).toBe("▓░░░░");
    expect(asciiBar(40)).toBe("▓▓░░░");
  });
});

describe("isoStamp (ground truth)", () => {
  it("renders empty for null", () => {
    expect(isoStamp(null)).toBe("");
  });
  it("slices an ISO day / datetime string to 10 chars", () => {
    expect(isoStamp("2024-05-01")).toBe("2024-05-01");
    expect(isoStamp("2024-05-01T12:00:00Z")).toBe("2024-05-01");
  });
  it("renders epoch ms as a UTC day stamp", () => {
    expect(isoStamp(0)).toBe("1970-01-01");
    expect(isoStamp(1700000000000)).toBe("2023-11-14");
  });
  it("falls back to String(ts) for an unparseable value", () => {
    expect(isoStamp("hello")).toBe("hello");
  });
});

describe("pctToNext (ground truth)", () => {
  const L = [{ min: 0 }, { min: 100 }, { min: 300 }];
  it("returns 0 when there are no levels", () => {
    expect(pctToNext(null, 5, 0)).toBe(0);
    expect(pctToNext([], 5, 0)).toBe(0);
  });
  it("computes progress toward the next level", () => {
    expect(pctToNext(L, 50, 0)).toBe(50);
    expect(pctToNext(L, 150, 1)).toBe(25);
  });
  it("returns 100 at the top level and clamps the band", () => {
    expect(pctToNext(L, 500, 2)).toBe(100); // no next level
    expect(pctToNext(L, -10, 0)).toBe(0); // clamps below 0
    expect(pctToNext(L, 200, 0)).toBe(100); // clamps above 100
  });
});

describe("constants", () => {
  it("keeps the canonical 8-domain fallback order", () => {
    expect(FALLBACK_DOMAINS).toEqual([
      "hebrew-greek",
      "cross-references",
      "gematria",
      "talmud",
      "patristics",
      "gnosis",
      "geography",
      "canon-coverage",
    ]);
  });
  it("maps quest step kinds to keys + english", () => {
    expect(STEP_KIND_KEY["reflect"]).toBe("cx.quest.step.reflect");
    expect(STEP_KIND_EN["connect"]).toBe("Connect");
  });
});
