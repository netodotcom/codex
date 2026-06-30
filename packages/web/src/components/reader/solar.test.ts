import { describe, it, expect } from "vitest";
import { computeSolar, solarHour, pad, fmtClock, fmtDate } from "./solar.js";

describe("solar", () => {
  it("pads to two digits", () => {
    expect(pad(0)).toBe("00");
    expect(pad(7)).toBe("07");
    expect(pad(23)).toBe("23");
  });

  it("formats clock + date", () => {
    const d = new Date(2024, 0, 5, 9, 7, 3); // 5 JAN 2024 09:07:03
    expect(fmtClock(d)).toBe("09:07:03");
    expect(fmtDate(d)).toBe("05 JAN 2024");
  });

  it("derives the fractional hour from a Date", () => {
    const d = new Date(2024, 0, 1, 6, 30, 0);
    expect(solarHour(d)).toBeCloseTo(6.5, 5);
  });

  it("bands the day into night/dawn/day/dusk (ground truth)", () => {
    expect(computeSolar(0)).toMatchObject({ phase: "night", label: "NOCT", t01: 0, sunPct: 0 });
    expect(computeSolar(6)).toMatchObject({ phase: "dawn", label: "AURO", t01: 0.25, sunPct: 0 });
    expect(computeSolar(12)).toMatchObject({ phase: "day", label: "DIES", t01: 0.5, sunPct: 100 });
    expect(computeSolar(19)).toMatchObject({ phase: "dusk", label: "VESP" });
    expect(computeSolar(23)).toMatchObject({ phase: "night", label: "NOCT" });
  });

  it("sun height is ~0 at the horizon (h=18)", () => {
    expect(computeSolar(18).sunPct).toBeCloseTo(0, 6);
    expect(computeSolar(18).phase).toBe("dusk");
  });
});
