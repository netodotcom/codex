// Ground truth captured by running a faithful copy of the legacy artParseBlocks
// in node (see migration notes). These exact values are asserted here.
import { describe, it, expect } from "vitest";
import { artParseBlocks } from "./blocks.js";

describe("artParseBlocks (ground truth)", () => {
  it("parses heading, paragraph (joined lines), list, quote, hr", () => {
    expect(artParseBlocks("# Title\n\nA para line\nsame para\n\n- a\n- b\n\n> quote here\n\n---")).toEqual([
      { type: "h", level: 1, text: "Title" },
      { type: "p", text: "A para line same para" },
      { type: "list", ordered: false, items: ["a", "b"] },
      { type: "quote", text: "quote here" },
      { type: "hr" },
    ]);
  });

  it("parses a table with header + rows", () => {
    expect(artParseBlocks("| A | B |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |")).toEqual([
      {
        type: "table",
        head: ["A", "B"],
        rows: [
          ["1", "2"],
          ["3", "4"],
        ],
      },
    ]);
  });

  it("parses a fenced directive block keeping the lang and verbatim code", () => {
    expect(artParseBlocks('```codex:chart\n{"a":1}\n```')).toEqual([{ type: "fence", lang: "codex:chart", code: '{"a":1}' }]);
  });

  it("parses an ordered list", () => {
    expect(artParseBlocks("1. first\n2. second")).toEqual([{ type: "list", ordered: true, items: ["first", "second"] }]);
  });

  it("treats an empty input as no blocks", () => {
    expect(artParseBlocks("")).toEqual([]);
  });
});
