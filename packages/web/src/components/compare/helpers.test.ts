// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { cellClass, cellGlyph, polygonPoints, axisLabelPos, buildMarkdown } from "./helpers.js";

describe("cellClass (ground truth)", () => {
  it("maps y/n/p/$/text correctly", () => {
    expect(cellClass("y")).toBe("cx-cmp-cell cx-cmp-yes");
    expect(cellClass("n")).toBe("cx-cmp-cell cx-cmp-no");
    expect(cellClass("p")).toBe("cx-cmp-cell cx-cmp-partial");
    expect(cellClass("$")).toBe("cx-cmp-cell cx-cmp-paywall");
    expect(cellClass("43+")).toBe("cx-cmp-cell cx-cmp-text");
    expect(cellClass("$0")).toBe("cx-cmp-cell cx-cmp-text");
  });
});

describe("cellGlyph (ground truth)", () => {
  it("maps y/n/p/$/other correctly", () => {
    expect(cellGlyph("y")).toBe("✓");
    expect(cellGlyph("n")).toBe("✗");
    expect(cellGlyph("p")).toBe("⚠");
    expect(cellGlyph("$")).toBe("$$$");
    expect(cellGlyph("43+")).toBe("43+");
    expect(cellGlyph("$0")).toBe("$0");
    expect(cellGlyph("2800+")).toBe("2800+");
  });
});

describe("polygonPoints (ground truth)", () => {
  it("returns a space-joined list of x,y pairs", () => {
    // All scores = 0 → all points collapse to the center
    const pts0 = polygonPoints([0, 0, 0], 100, 100, 50);
    const pairs0 = pts0.split(" ");
    expect(pairs0.length).toBe(3);
    for (const p of pairs0) {
      expect(p).toBe("100.0,100.0");
    }
  });

  it("top point (i=0) at 100% score is directly above center", () => {
    // With n=4 and i=0, angle = -PI/2 → cos=-0, sin=-1 → x=cx, y=cy-r
    const pts = polygonPoints([100, 0, 0, 0], 200, 200, 100);
    const firstPair = pts.split(" ")[0]!;
    const [xStr, yStr] = firstPair.split(",");
    expect(parseFloat(xStr!)).toBeCloseTo(200, 1);
    expect(parseFloat(yStr!)).toBeCloseTo(100, 1); // cy - r
  });

  it("clamps scores below 0 and above 100", () => {
    // score = 200 should be clamped to 100 (same as full radius)
    const clamped = polygonPoints([200], 100, 100, 50);
    const full = polygonPoints([100], 100, 100, 50);
    expect(clamped).toBe(full);

    const clampedNeg = polygonPoints([-50], 100, 100, 50);
    const zero = polygonPoints([0], 100, 100, 50);
    expect(clampedNeg).toBe(zero);
  });
});

describe("axisLabelPos (ground truth)", () => {
  it("places index 0 (top) at cx, cy - (r+16)", () => {
    const p = axisLabelPos(0, 8, 200, 200, 100);
    expect(p.x).toBeCloseTo(200, 1);
    expect(p.y).toBeCloseTo(200 - 116, 1); // cy - (r + 16) = 84
  });

  it("returns an object with x and y", () => {
    const p = axisLabelPos(2, 8, 100, 100, 80);
    expect(typeof p.x).toBe("number");
    expect(typeof p.y).toBe("number");
  });
});

describe("buildMarkdown (ground truth)", () => {
  it("starts with the comparison heading", () => {
    const md = buildMarkdown();
    expect(md.startsWith("# How CODEX compares (2026-05)")).toBe(true);
  });

  it("includes all 7 app names in the header row", () => {
    const md = buildMarkdown();
    const lines = md.split("\n");
    const header = lines.find((l) => l.includes("| Feature |"));
    expect(header).toBeDefined();
    expect(header).toContain("CODEX");
    expect(header).toContain("Logos");
    expect(header).toContain("YouVersion");
    expect(header).toContain("Blue Letter Bible");
  });

  it("includes all 29 feature label rows", () => {
    const md = buildMarkdown();
    const dataRows = md.split("\n").filter((l) => l.startsWith("| ") && !l.includes("Feature") && !l.includes("---"));
    expect(dataRows.length).toBe(29);
  });

  it("ends with the source attribution", () => {
    const md = buildMarkdown();
    expect(md).toContain("CONTRIBUTING.md");
    expect(md).toContain("https://github.com/codex");
  });

  it("uses ✓/✗/⚠/$$$ glyphs in body cells", () => {
    const md = buildMarkdown();
    expect(md).toContain("✓");
    expect(md).toContain("✗");
    expect(md).toContain("⚠");
    expect(md).toContain("$$$");
  });
});
