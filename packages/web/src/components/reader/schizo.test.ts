import { describe, it, expect } from "vitest";
import { schizoCompute, SCHIZO_SIGNIFICANT, type GematriaEngine } from "./schizo.js";

const fakeEngine = (lang: string, all: Record<string, number>): GematriaEngine => ({
  detectLang: () => lang,
  all: () => all,
});

describe("schizoCompute", () => {
  it("picks hechrachi for Hebrew", () => {
    const info = schizoCompute("אהבה", fakeEngine("hebrew", { hechrachi: 13, ordinal: 4 }));
    expect(info).toMatchObject({ lang: "hebrew", primaryVal: 13, primarySys: "hechrachi" });
  });
  it("picks isopsephy for Greek", () => {
    const info = schizoCompute("λόγος", fakeEngine("greek", { isopsephy: 373, ordinal: 50 }));
    expect(info).toMatchObject({ lang: "greek", primaryVal: 373, primarySys: "isopsephy" });
  });
  it("falls back to ordinal for other languages", () => {
    const info = schizoCompute("love", fakeEngine("latin", { ordinal: 54 }));
    expect(info).toMatchObject({ lang: "latin", primaryVal: 54, primarySys: "ordinal" });
  });
  it("returns null without an engine or text", () => {
    expect(schizoCompute("", fakeEngine("greek", { isopsephy: 1 }))).toBeNull();
  });
});

describe("SCHIZO_SIGNIFICANT", () => {
  it("flags the significant values with their glow class", () => {
    expect(SCHIZO_SIGNIFICANT[666]).toBe("rev");
    expect(SCHIZO_SIGNIFICANT[888]).toBe("gold");
    expect(SCHIZO_SIGNIFICANT[153]).toBe("blue");
  });
});
