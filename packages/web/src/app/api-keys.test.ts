import { describe, it, expect } from "vitest";
import { normalizeKeys } from "./api-keys.js";

describe("normalizeKeys (ground truth)", () => {
  it("defaults an empty blob to anthropic", () => {
    expect(normalizeKeys({}).active).toBe("anthropic");
  });
  it("keeps a valid active provider that has a key", () => {
    expect(normalizeKeys({ active: "grok", grok: "x" }).active).toBe("grok");
  });
  it("falls back to anthropic when the active provider has no key and no others exist", () => {
    expect(normalizeKeys({ active: "grok" }).active).toBe("anthropic");
  });
  it("falls through to the first provider that does have a key", () => {
    expect(normalizeKeys({ active: "anthropic", groq: "g" }).active).toBe("groq");
  });
  it("always allows ollama (no key needed)", () => {
    expect(normalizeKeys({ active: "ollama" }).active).toBe("ollama");
  });
  it("trims whitespace from keys", () => {
    const k = normalizeKeys({ active: "anthropic", anthropic: "  sk-ant-xyz  " });
    expect(k.anthropic).toBe("sk-ant-xyz");
  });
});
