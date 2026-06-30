import { describe, it, expect } from "vitest";
import { buildScriptureParts, extractJesusQuoteHeuristic } from "./scripture.js";

describe("extractJesusQuoteHeuristic", () => {
  it("pulls the trailing clause after a 'said unto them,' attribution", () => {
    expect(extractJesusQuoteHeuristic("And Jesus said unto them, Follow me and I will make you fishers.")).toEqual([
      "Follow me and I will make you fishers.",
    ]);
  });
  it("returns null when there is no attribution", () => {
    expect(extractJesusQuoteHeuristic("In the beginning was the Word.")).toBeNull();
  });
  it("returns null when the trailing clause is too short", () => {
    expect(extractJesusQuoteHeuristic("He said, Go now.")).toBeNull();
  });
});

describe("buildScriptureParts", () => {
  it("wraps a single red quote, leaving plain text around it (ground truth)", () => {
    expect(buildScriptureParts("Jesus said Love one another truly to them.", ["Love one another truly"], false)).toEqual([
      { t: "Jesus said ", kind: null },
      { t: "Love one another truly", kind: "red" },
      { t: " to them.", kind: null },
    ]);
  });

  it("paints the whole verse red when wholeVerse and no quotes survive the heuristic", () => {
    expect(buildScriptureParts("Ego sum via veritas et vita.", null, true)).toEqual([
      { t: "Ego sum via veritas et vita.", kind: "red" },
    ]);
  });

  it("leaves text plain when there is nothing to wrap", () => {
    expect(buildScriptureParts("In the beginning.", null, false)).toEqual([{ t: "In the beginning.", kind: null }]);
  });

  it("wraps multiple quotes in order", () => {
    expect(buildScriptureParts("alpha beta gamma delta", ["beta", "delta"], false)).toEqual([
      { t: "alpha ", kind: null },
      { t: "beta", kind: "red" },
      { t: " gamma ", kind: null },
      { t: "delta", kind: "red" },
    ]);
  });
});
