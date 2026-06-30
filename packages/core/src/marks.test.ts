import { describe, it, expect } from "vitest";
import { markSignature, previewMark, parseRankResults, pruneCache, type Mark } from "./marks.js";

const M = (key: string, extra: Partial<Mark> = {}): Mark => ({ key, ...extra });

describe("markSignature", () => {
  it("is stable regardless of mark order and normalizes the query", () => {
    const a = markSignature("  Love ", [M("b"), M("a")]);
    const b = markSignature("love", [M("a"), M("b")]);
    expect(a).toBe(b);
    expect(a).toBe("love||2||a,b");
  });
});

describe("previewMark", () => {
  it("renders a 1-indexed preview line with optional note/text", () => {
    expect(previewMark(M("k1", { ref: "jhn.1.1", color: "gold" }), 0)).toBe("1. [k1] jhn.1.1 · gold");
    expect(previewMark(M("k2", { ref: "rom.8.38", color: "red", note: "hope" }), 1)).toBe(
      '2. [k2] rom.8.38 · red · note:"hope"',
    );
  });
});

describe("parseRankResults", () => {
  const marks = [M("a"), M("b"), M("c")];

  it("extracts a JSON array even with fences / leading prose", () => {
    const reply = 'Here you go:\n```json\n[{"key":"b","reason":"theme of love"}]\n```';
    expect(parseRankResults(reply, marks)).toEqual([{ key: "b", reason: "theme of love" }]);
  });

  it("drops keys not in the mark set and caps at 12", () => {
    const many = Array.from({ length: 20 }, (_, i) => ({ key: String(i), reason: "r" }));
    const allMarks = many.map((x) => M(x.key));
    expect(parseRankResults(JSON.stringify(many), allMarks)).toHaveLength(12);
    expect(parseRankResults('[{"key":"zzz","reason":"x"},{"key":"a","reason":"y"}]', marks)).toEqual([
      { key: "a", reason: "y" },
    ]);
  });

  it("returns [] when there is no array or invalid JSON", () => {
    expect(parseRankResults("no array here", marks)).toEqual([]);
    expect(parseRankResults("[not json]", marks)).toEqual([]);
  });
});

describe("pruneCache", () => {
  it("evicts oldest-by-ts beyond the max", () => {
    const cache: Record<string, { ts?: number }> = {
      old: { ts: 1 },
      mid: { ts: 2 },
      new: { ts: 3 },
    };
    pruneCache(cache, 2);
    expect(Object.keys(cache).sort()).toEqual(["mid", "new"]);
  });

  it("leaves a small cache untouched", () => {
    const cache = { a: { ts: 1 } };
    expect(pruneCache(cache, 5)).toBe(cache);
  });
});
