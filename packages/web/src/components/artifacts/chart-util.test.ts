// Ground truth captured by running the legacy artNum/artFmt in node.
import { describe, it, expect } from "vitest";
import { artNum, artFmt, ART_HUES, ART_ACCENT } from "./chart-util.js";

describe("artNum (ground truth)", () => {
  it("parses finite numbers and floors non-finite to 0", () => {
    expect(artNum("3.5")).toBe(3.5);
    expect(artNum(7)).toBe(7);
    expect(artNum("nope")).toBe(0);
    expect(artNum(Infinity)).toBe(0);
    expect(artNum(null)).toBe(0);
  });
});

describe("artFmt (ground truth)", () => {
  it("rounds to whole numbers at/above 1000 and to 2dp below", () => {
    expect(artFmt(4)).toBe("4");
    expect(artFmt(1234.5)).toBe("1235");
    expect(artFmt(0.126)).toBe("0.13");
    expect(artFmt("x")).toBe("0");
  });
});

describe("theme tokens", () => {
  it("exposes the exact accent token and the 7-hue palette", () => {
    expect(ART_ACCENT).toBe("var(--cx-accent, #7ee0ff)");
    expect(ART_HUES).toEqual(["#7ee0ff", "#c7a9ff", "#8de8a8", "#ffc46b", "#ff8291", "#6bc6ff", "#e8d68d"]);
  });
});
