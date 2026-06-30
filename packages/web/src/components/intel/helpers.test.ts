// @vitest-environment jsdom
// Ground-truth tests for intel pure helpers. Values were derived by running the
// legacy intel.jsx logic verbatim in Node, then asserting exact outputs here.
import { describe, it, expect } from "vitest";
import {
  intelGrade, intelFmtYear, intelEscapeHtml, intelParseJSON, intelErrMessage, intelReducedMotion,
} from "./helpers.js";

// ── intelGrade ───────────────────────────────────────────────────────────────
describe("intelGrade (ground truth)", () => {
  it("0–44 → FAINT", () => {
    expect(intelGrade(0)).toEqual({ key: "faint", label: "FAINT" });
    expect(intelGrade(44)).toEqual({ key: "faint", label: "FAINT" });
  });
  it("45–74 → MODERATE", () => {
    expect(intelGrade(45)).toEqual({ key: "moderate", label: "MODERATE" });
    expect(intelGrade(74)).toEqual({ key: "moderate", label: "MODERATE" });
  });
  it("75–100 → STRONG", () => {
    expect(intelGrade(75)).toEqual({ key: "strong", label: "STRONG" });
    expect(intelGrade(100)).toEqual({ key: "strong", label: "STRONG" });
  });
  it("coerces non-numbers (null → 0 → FAINT; string '80' → STRONG)", () => {
    expect(intelGrade(null)).toEqual({ key: "faint", label: "FAINT" });
    expect(intelGrade("80")).toEqual({ key: "strong", label: "STRONG" });
    expect(intelGrade(undefined)).toEqual({ key: "faint", label: "FAINT" });
  });
});

// ── intelFmtYear ─────────────────────────────────────────────────────────────
describe("intelFmtYear (ground truth)", () => {
  it("returns em-dash for 0, null, undefined, NaN", () => {
    expect(intelFmtYear(0)).toBe("—");
    expect(intelFmtYear(null)).toBe("—");
    expect(intelFmtYear(undefined)).toBe("—");
    expect(intelFmtYear(NaN)).toBe("—");
  });
  it("formats positive years as CE", () => {
    expect(intelFmtYear(70)).toBe("70 CE");
    expect(intelFmtYear(1)).toBe("1 CE");
    expect(intelFmtYear(2024)).toBe("2024 CE");
  });
  it("formats negative years as BCE", () => {
    expect(intelFmtYear(-1492)).toBe("1492 BCE");
    expect(intelFmtYear(-586)).toBe("586 BCE");
    expect(intelFmtYear(-1)).toBe("1 BCE");
  });
});

// ── intelEscapeHtml ──────────────────────────────────────────────────────────
describe("intelEscapeHtml (ground truth)", () => {
  it("escapes &, <, >, \", '", () => {
    expect(intelEscapeHtml("<script>alert('x')</script>")).toBe(
      "&lt;script&gt;alert(&#39;x&#39;)&lt;/script&gt;",
    );
    expect(intelEscapeHtml("a & b")).toBe("a &amp; b");
    expect(intelEscapeHtml('"quoted"')).toBe("&quot;quoted&quot;");
  });
  it("passes through strings with no special chars", () => {
    expect(intelEscapeHtml("hello world")).toBe("hello world");
  });
  it("coerces non-strings", () => {
    expect(intelEscapeHtml(42)).toBe("42");
    expect(intelEscapeHtml(null)).toBe("null");
    expect(intelEscapeHtml(undefined)).toBe("undefined");
  });
});

// ── intelParseJSON ───────────────────────────────────────────────────────────
describe("intelParseJSON (ground truth)", () => {
  it("parses valid JSON without recovery", () => {
    expect(intelParseJSON('{"a":1,"b":"hello"}')).toEqual({ a: 1, b: "hello" });
    expect(intelParseJSON("[1,2,3]")).toEqual([1, 2, 3]);
    expect(intelParseJSON('"string"')).toBe("string");
  });
  it("recovers from truncated object — complete key:value pair is retained", () => {
    // "b":2 is fully present → recovered
    expect(intelParseJSON('{"a":1,"b":2')).toEqual({ a: 1, b: 2 });
  });
  it("recovers from object with trailing comma (comma marks the safe point)", () => {
    // safe point is set AT the comma position, slice excludes it
    const result = intelParseJSON('{"x":10,');
    expect((result as { x: number }).x).toBe(10);
  });
  it("recovers from deeply nested truncation", () => {
    // outer object key "a" has a complete value; "b" is nested partial
    expect(intelParseJSON('{"a":1,"b":{"c":42')).toMatchObject({ a: 1, b: { c: 42 } });
  });
});

// ── intelErrMessage ──────────────────────────────────────────────────────────
describe("intelErrMessage (ground truth)", () => {
  it("extracts a top-level string error field", () => {
    expect(intelErrMessage({ error: "rate limited" }, 429)).toBe("rate limited");
  });
  it("extracts message from a nested error object", () => {
    expect(intelErrMessage({ error: { message: "quota exceeded" } }, 402)).toBe("quota exceeded");
  });
  it("extracts type when message is absent", () => {
    expect(intelErrMessage({ error: { type: "auth_error" } }, 401)).toBe("auth_error");
  });
  it("falls back to HTTP status for empty or non-object body", () => {
    expect(intelErrMessage({}, 500)).toBe("HTTP 500");
    expect(intelErrMessage(null, 503)).toBe("HTTP 503");
    expect(intelErrMessage("oops", 400)).toBe("HTTP 400");
  });
});

// ── intelReducedMotion ───────────────────────────────────────────────────────
describe("intelReducedMotion", () => {
  it("returns a boolean without throwing (jsdom: matchMedia returns false)", () => {
    const result = intelReducedMotion();
    expect(typeof result).toBe("boolean");
    // In jsdom, prefers-reduced-motion is not set so result must be false
    expect(result).toBe(false);
  });
});
