import { describe, it, expect } from "vitest";
import { flattenSystem, flattenContent } from "./flatten.js";

describe("flattenSystem", () => {
  it("passes a string through", () => {
    expect(flattenSystem("You are CODEX.")).toBe("You are CODEX.");
  });
  it("joins an array of blocks/strings with blank lines and trims", () => {
    expect(flattenSystem([{ type: "text", text: "A" }, "B", { text: "C" }])).toBe("A\n\nB\n\nC");
  });
  it("reads a single block object", () => {
    expect(flattenSystem({ type: "text", text: "hi" })).toBe("hi");
  });
  it("empty for null/undefined", () => {
    expect(flattenSystem(null)).toBe("");
    expect(flattenSystem(undefined)).toBe("");
  });
});

describe("flattenContent", () => {
  it("passes a string through", () => {
    expect(flattenContent("hello")).toBe("hello");
  });
  it("joins an array with newlines", () => {
    expect(flattenContent([{ type: "text", text: "x" }, "y"])).toBe("x\ny");
  });
  it("reads a block object", () => {
    expect(flattenContent({ text: "z" })).toBe("z");
  });
});
