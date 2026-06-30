// oracle2 — helpers unit tests (node environment).
// Ground truth for oracle2ParseToolCall (pure) and the ORACLE2_INVOCATIONS
// prompts. oracle2ToolDirective touches the window so it is tested in OracleX.test.tsx.
import { describe, it, expect } from "vitest";
import {
  oracle2ParseToolCall,
  ORACLE2_INVOCATIONS,
  ORACLE2_SYSTEM,
} from "./helpers.js";

// ── oracle2ParseToolCall ──────────────────────────────────────────────────────
describe("oracle2ParseToolCall", () => {
  it("returns null for null/undefined/empty input", () => {
    expect(oracle2ParseToolCall(null)).toBeNull();
    expect(oracle2ParseToolCall(undefined)).toBeNull();
    expect(oracle2ParseToolCall("")).toBeNull();
  });

  it("parses a bare JSON tool call at the start of the string", () => {
    const result = oracle2ParseToolCall('{"tool":"read_passage","args":{"ref":"John 3:16"}}');
    expect(result).toEqual({ tool: "read_passage", args: { ref: "John 3:16" } });
  });

  it("strips markdown fences before parsing", () => {
    const result = oracle2ParseToolCall("```json\n{\"tool\":\"search_text\",\"args\":{\"q\":\"love\"}}\n```");
    expect(result).toEqual({ tool: "search_text", args: { q: "love" } });
  });

  it("trims the tool name", () => {
    const result = oracle2ParseToolCall('{"tool":" goto ","args":{}}');
    expect(result).toEqual({ tool: "goto", args: {} });
  });

  it("defaults args to {} when args is missing", () => {
    const result = oracle2ParseToolCall('{"tool":"open_console"}');
    expect(result).toEqual({ tool: "open_console", args: {} });
  });

  it("defaults args to {} when args is not an object", () => {
    const result = oracle2ParseToolCall('{"tool":"foo","args":"bad"}');
    expect(result).toEqual({ tool: "foo", args: {} });
  });

  it("returns null when the tool name is an empty string", () => {
    expect(oracle2ParseToolCall('{"tool":"","args":{}}')).toBeNull();
    expect(oracle2ParseToolCall('{"tool":"  ","args":{}}')).toBeNull();
  });

  it("returns null when JSON is embedded in prose (a > 8)", () => {
    const prose = 'Sure! Here is the call: {"tool":"foo","args":{}}';
    expect(oracle2ParseToolCall(prose)).toBeNull();
  });

  it("returns null for plain prose with no JSON", () => {
    expect(oracle2ParseToolCall("The answer is in Genesis 1:1.")).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    expect(oracle2ParseToolCall("{tool:bad}")).toBeNull();
  });

  it("returns null when tool key is missing", () => {
    expect(oracle2ParseToolCall('{"name":"read_passage","args":{}}')).toBeNull();
  });

  it("returns null when tool value is not a string", () => {
    expect(oracle2ParseToolCall('{"tool":42,"args":{}}')).toBeNull();
  });

  it("uses the LAST closing brace so nested JSON works", () => {
    const result = oracle2ParseToolCall('{"tool":"set","args":{"val":{"a":1}}}');
    expect(result).toEqual({ tool: "set", args: { val: { a: 1 } } });
  });
});

// ── ORACLE2_INVOCATIONS ───────────────────────────────────────────────────────
describe("ORACLE2_INVOCATIONS", () => {
  it("has 5 invocations with expected ids", () => {
    expect(ORACLE2_INVOCATIONS).toHaveLength(5);
    const ids = ORACLE2_INVOCATIONS.map((i) => i.id);
    expect(ids).toEqual(["illuminate", "context", "tongue", "threads", "contra"]);
  });

  it("each invocation has a glyph, label, and a prompt function", () => {
    for (const inv of ORACLE2_INVOCATIONS) {
      expect(typeof inv.glyph).toBe("string");
      expect(inv.glyph.length).toBeGreaterThan(0);
      expect(typeof inv.label).toBe("string");
      expect(typeof inv.prompt).toBe("function");
    }
  });

  it("prompts embed the ref argument", () => {
    for (const inv of ORACLE2_INVOCATIONS) {
      const p = inv.prompt("John 3:16");
      expect(p).toContain("John 3:16");
    }
  });

  it("illuminate prompt contains 'plain meaning'", () => {
    const inv = ORACLE2_INVOCATIONS.find((i) => i.id === "illuminate")!;
    expect(inv.prompt("Ps 22:1")).toContain("plain meaning");
  });

  it("contra prompt contains 'CONTESTED'", () => {
    const inv = ORACLE2_INVOCATIONS.find((i) => i.id === "contra")!;
    expect(inv.prompt("Rev 1:1")).toContain("CONTESTED");
  });
});

// ── ORACLE2_SYSTEM ────────────────────────────────────────────────────────────
describe("ORACLE2_SYSTEM", () => {
  it("contains the ORACLE identity and key honesty rules", () => {
    expect(ORACLE2_SYSTEM).toContain("THE ORACLE");
    expect(ORACLE2_SYSTEM).toContain("HONESTY RULES");
    expect(ORACLE2_SYSTEM).toContain("CONTESTED");
    expect(ORACLE2_SYSTEM).toContain("CODEX");
  });
});
