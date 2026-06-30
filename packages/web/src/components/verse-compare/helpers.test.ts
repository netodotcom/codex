import { describe, it, expect } from "vitest";
import { computeInitialIds, addAdjacentVerse } from "./helpers.js";

// Ground truth values verified against faithful JS execution of the original
// legacy logic before writing these assertions.

describe("computeInitialIds", () => {
  it("places primary first then includes remaining translation ids", () => {
    const trans = [{ id: "kjv" }, { id: "esv" }, { id: "web" }];
    expect(computeInitialIds("esv", trans)).toEqual(["esv", "kjv", "web"]);
  });

  it("deduplicates primary when it also appears in allTrans", () => {
    const trans = [{ id: "kjv" }, { id: "web" }];
    expect(computeInitialIds("kjv", trans)).toEqual(["kjv", "web"]);
  });

  it("caps at 12 by default", () => {
    const trans = Array.from({ length: 15 }, (_, i) => ({ id: `t${i}` }));
    const result = computeInitialIds("t0", trans);
    expect(result.length).toBe(12);
    // primary (t0) is already in the list — Set deduplicates it, so first 12
    // of the unique set is t0..t11
    expect(result[0]).toBe("t0");
  });

  it("respects a custom limit", () => {
    const trans = [{ id: "a" }, { id: "b" }, { id: "c" }];
    // primary "x" comes first, then "a", reaching limit 2
    expect(computeInitialIds("x", trans, 2)).toEqual(["x", "a"]);
  });

  it("handles empty translation list", () => {
    expect(computeInitialIds("kjv", [])).toEqual(["kjv"]);
  });
});

describe("addAdjacentVerse", () => {
  it("adds the next verse (delta +1) from the max", () => {
    expect(addAdjacentVerse([3], 1)).toEqual([3, 4]);
  });

  it("adds the previous verse (delta -1) from the min", () => {
    expect(addAdjacentVerse([3], -1)).toEqual([2, 3]);
  });

  it("does not add a verse below 1, returns array unchanged", () => {
    const orig = [1];
    const result = addAdjacentVerse(orig, -1);
    expect(result).toBe(orig); // exact same reference
  });

  it("extends from the maximum when delta is positive (multi-verse set)", () => {
    expect(addAdjacentVerse([2, 5, 8], 1)).toEqual([2, 5, 8, 9]);
  });

  it("extends from the minimum when delta is negative (multi-verse set)", () => {
    expect(addAdjacentVerse([2, 5, 8], -1)).toEqual([1, 2, 5, 8]);
  });

  it("keeps result sorted numerically", () => {
    const result = addAdjacentVerse([10, 5], -1);
    expect(result).toEqual([4, 5, 10]);
  });
});
