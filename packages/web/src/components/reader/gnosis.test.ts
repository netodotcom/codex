import { describe, it, expect } from "vitest";
import { gnosisInsertionPoints } from "./gnosis.js";

describe("gnosisInsertionPoints", () => {
  it("returns an empty map when there is no gnosis or no verses", () => {
    expect([...gnosisInsertionPoints(10, 0)]).toEqual([]);
    expect([...gnosisInsertionPoints(0, 3)]).toEqual([]);
  });

  it("spreads 2 entries evenly across 10 verses (ground truth)", () => {
    expect([...gnosisInsertionPoints(10, 2)]).toEqual([
      [3, 0],
      [7, 1],
    ]);
  });

  it("spreads 3 entries across 12 verses (ground truth)", () => {
    expect([...gnosisInsertionPoints(12, 3)]).toEqual([
      [3, 0],
      [6, 1],
      [9, 2],
    ]);
  });
});
