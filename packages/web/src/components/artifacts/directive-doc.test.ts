import { describe, it, expect } from "vitest";
import { artDirectiveDoc } from "./directive-doc.js";

describe("artDirectiveDoc", () => {
  const doc = artDirectiveDoc();

  it("is a newline-joined string teaching the four fenced directives", () => {
    expect(typeof doc).toBe("string");
    expect(doc).toContain("```codex:buttons");
    expect(doc).toContain("```codex:chart");
    expect(doc).toContain("```codex:flow");
    expect(doc).toContain("```codex:verse-grid");
  });

  it("documents the [j]/[d] tags and the action kinds", () => {
    expect(doc).toContain("[j]exact Jesus quote[/j]");
    expect(doc).toContain("[d]exact God-the-Father quote[/d]");
    expect(doc).toContain('"goto"');
    expect(doc).toContain('"panel"');
    expect(doc).toContain('"console"');
    expect(doc).toContain('"setting"');
  });

  it("opens with the rich-output banner line", () => {
    expect(doc.startsWith("RICH OUTPUT — your replies render through the CODEX artifacts engine:")).toBe(true);
  });
});
