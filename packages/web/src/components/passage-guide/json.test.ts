import { describe, it, expect } from "vitest";
import { smartRepair, extractJSON, validate } from "./json.js";

// Ground truth captured by running the ORIGINAL passage-guide.jsx pure fns in node.

describe("smartRepair (ground truth)", () => {
  it("closes an open object after a dangling key:value", () => {
    expect(smartRepair('{"a":1,"b":')).toBe('{"a":1,"b"}');
  });
  it("closes an open array and object", () => {
    expect(smartRepair('{"a":[1,2,3')).toBe('{"a":[1,2,3]}');
  });
  it("keeps a complete string value, closes the object", () => {
    expect(smartRepair('{"a":"hello","b"')).toBe('{"a":"hello","b"}');
  });
});

describe("extractJSON (ground truth)", () => {
  it("strips ```json fences", () => {
    expect(extractJSON('```json\n{"a":1,"b":"x"}\n```')).toEqual({ a: 1, b: "x" });
  });
  it("ignores trailing prose after the object", () => {
    expect(extractJSON('{"a":1} some trailing prose')).toEqual({ a: 1 });
  });
  it("ignores a preamble before the object", () => {
    expect(extractJSON('Here is the JSON:\n{"overview":"hi"}')).toEqual({ overview: "hi" });
  });
  it("repairs a truncated object/array via smartRepair", () => {
    expect(extractJSON('{"overview":"hi","outline":[{"title":"x","range":"1-5"')).toEqual({
      overview: "hi",
      outline: [{ title: "x", range: "1-5" }],
    });
  });
  it("drops a dangling truncated key", () => {
    expect(extractJSON('{"overview":"hi","historical')).toEqual({ overview: "hi" });
  });
  it("throws on empty input", () => {
    expect(() => extractJSON("")).toThrow("empty response");
  });
  it("throws when there is no object", () => {
    expect(() => extractJSON("no object here")).toThrow("no json object found");
  });
});

describe("validate (ground truth)", () => {
  it("normalises, filters, and stamps the schema", () => {
    const out = validate({
      overview: "ov",
      outline: [{ title: "t" }, { summary: "s" }, { nope: 1 }],
      themes: [{ name: "n" }, { x: 1 }],
      key_words: [{ word: "w" }, { translit: "t" }],
      historical_context: "hc",
      synthesis: "sy",
    });
    expect(out).toEqual({
      overview: "ov",
      outline: [{ title: "t" }, { summary: "s" }],
      themes: [{ name: "n" }],
      key_words: [{ word: "w" }],
      historical_context: "hc",
      synthesis: "sy",
      _schema: 1,
    });
  });
  it("fills defaults for an empty object", () => {
    expect(validate({})).toEqual({
      _schema: 1,
      overview: "",
      outline: [],
      themes: [],
      key_words: [],
      historical_context: "",
      synthesis: "",
    });
  });
  it("slices outline to 8 entries", () => {
    const out = validate({ outline: Array.from({ length: 12 }, (_, i) => ({ title: "t" + i })) });
    expect(out.outline).toHaveLength(8);
    expect(out.outline![7]).toEqual({ title: "t7" });
  });
  it("throws on null / non-object", () => {
    expect(() => validate(null)).toThrow("not an object");
    expect(() => validate(42)).toThrow("not an object");
  });
});
