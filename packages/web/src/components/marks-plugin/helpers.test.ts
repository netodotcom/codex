// Pure-logic tests for marks-plugin helpers (node environment — no jsdom needed).
// Ground truth values captured from faithful runs of the v10 logic.
import { describe, it, expect } from "vitest";
import { marksAgo, hueColor, MARKS_KEY, MARKS_PINS_KEY } from "./helpers.js";

// ── marksAgo ground truth ─────────────────────────────────────────────────

describe("marksAgo", () => {
  it("returns empty string for undefined ts", () => {
    expect(marksAgo(undefined)).toBe("");
  });

  it("returns empty string for ts === 0 (falsy)", () => {
    expect(marksAgo(0)).toBe("");
  });

  it("returns at least '1m' for a very recent timestamp", () => {
    // 10 seconds ago → Math.max(1, floor(10/60)) = 1
    expect(marksAgo(Date.now() - 10_000)).toBe("1m");
  });

  it("returns minutes for elapsed < 1 hour", () => {
    // 5 minutes ago
    expect(marksAgo(Date.now() - 5 * 60_000)).toBe("5m");
  });

  it("returns hours for elapsed in [1 h, 24 h)", () => {
    // 3 hours ago
    expect(marksAgo(Date.now() - 3 * 3_600_000)).toBe("3h");
  });

  it("returns days for elapsed in [1 day, 30 days)", () => {
    // 7 days ago
    expect(marksAgo(Date.now() - 7 * 86_400_000)).toBe("7d");
  });

  it("returns toLocaleDateString() for elapsed ≥ 30 days", () => {
    const ts = new Date("2020-01-01").getTime();
    expect(marksAgo(ts)).toBe(new Date(ts).toLocaleDateString());
  });
});

// ── hueColor ground truth ─────────────────────────────────────────────────

describe("hueColor", () => {
  it("resolves amber → #ffd479", () => expect(hueColor("amber")).toBe("#ffd479"));
  it("resolves rose  → #ff8291", () => expect(hueColor("rose")).toBe("#ff8291"));
  it("resolves mint  → #5bd0b0", () => expect(hueColor("mint")).toBe("#5bd0b0"));
  it("resolves violet→ #b88cff", () => expect(hueColor("violet")).toBe("#b88cff"));
  it("resolves cyan  → #7ee0ff", () => expect(hueColor("cyan")).toBe("#7ee0ff"));
  it("resolves gold  → #ffd479", () => expect(hueColor("gold")).toBe("#ffd479"));

  it("falls back to amber for unknown color string", () => {
    expect(hueColor("unknown-colour")).toBe("#ffd479");
  });

  it("falls back to amber for undefined", () => {
    expect(hueColor(undefined)).toBe("#ffd479");
  });

  it("falls back to amber for empty string", () => {
    expect(hueColor("")).toBe("#ffd479");
  });
});

// ── storage key constants ─────────────────────────────────────────────────

describe("storage key constants", () => {
  it("MARKS_KEY is the v1 highlights schema key", () => {
    expect(MARKS_KEY).toBe("codex.highlights.v1");
  });

  it("MARKS_PINS_KEY is the v1 pins schema key", () => {
    expect(MARKS_PINS_KEY).toBe("codex.marks.pinned.v1");
  });
});
