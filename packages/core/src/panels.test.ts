import { describe, it, expect } from "vitest";
import {
  engineSuffix,
  panelCacheKey,
  wrapPanelCache,
  unwrapPanelCache,
  coercePanelData,
  coerceExegesis,
  coerceTxAnalysis,
} from "./panels.js";

describe("engineSuffix", () => {
  it("is empty for the default anthropic engine", () => {
    expect(engineSuffix()).toBe("");
    expect(engineSuffix({ provider: "anthropic", model: "default" })).toBe("");
  });
  it("slugifies provider + model for other engines", () => {
    expect(engineSuffix({ provider: "groq", model: "llama-3.3" })).toBe(".groq.llama-3_3");
  });
});

describe("panelCacheKey", () => {
  it("keys by book + chapter, with language and engine suffixes", () => {
    expect(panelCacheKey("jhn", 1)).toBe("codex.panels.v1.jhn.1");
    expect(panelCacheKey("jhn", 1, { lang: "es" })).toBe("codex.panels.v1.jhn.1.es");
    expect(panelCacheKey("jhn", 1, { lang: "en" })).toBe("codex.panels.v1.jhn.1");
    expect(panelCacheKey("jhn", 1, { engine: { provider: "groq", model: "x" } })).toBe(
      "codex.panels.v1.jhn.1.groq.x",
    );
  });
});

describe("panel cache wrapper", () => {
  it("wraps with a fixed clock and round-trips", () => {
    const entry = wrapPanelCache({ a: 1 }, 1700000000000);
    expect(entry).toEqual({ _v: 2, data: { a: 1 }, fetchedAt: 1700000000000 });
    expect(unwrapPanelCache(entry)).toEqual({ data: { a: 1 }, fetchedAt: 1700000000000 });
  });
  it("migrates a legacy bare object (fetchedAt 0)", () => {
    expect(unwrapPanelCache({ title: "x" })).toEqual({ data: { title: "x" }, fetchedAt: 0 });
  });
  it("returns null for non-objects", () => {
    expect(unwrapPanelCache(null)).toBeNull();
    expect(unwrapPanelCache("nope")).toBeNull();
  });
});

describe("coercePanelData", () => {
  it("defaults strings, caps arrays, and preserves extras", () => {
    const out = coercePanelData({
      title: "T",
      talmud: Array.from({ length: 9 }, (_, i) => ({ heading: `h${i}` })),
      extra: "kept",
    });
    expect(out.title).toBe("T");
    expect(out.subtitle).toBe("");
    expect(out.talmud).toHaveLength(6); // capped from 9
    expect(out.commentary).toEqual([]);
    expect(out["extra"]).toBe("kept");
  });

  it("drops malformed entries", () => {
    const out = coercePanelData({
      talmud: [{ body: "ok" }, { junk: 1 }, 42],
      gematria: [{ term: "λ", value: 30 }, { term: "x" }, { value: 5 }],
      crossRefs: [{ ref: "gen.1.1" }, { note: "no ref" }],
    });
    expect(out.talmud).toEqual([{ body: "ok" }]);
    expect(out.gematria).toEqual([{ term: "λ", value: 30 }]); // needs term + numeric value
    expect(out.crossRefs).toEqual([{ ref: "gen.1.1" }]);
  });

  it("normalizes the deep-gematria subtree (schema 2)", () => {
    const out = coercePanelData({
      gematriaDeep: {
        cross_matches: [{ matches: Array.from({ length: 9 }, (_, i) => i) }],
        notarikon: Array.from({ length: 7 }, (_, i) => i),
        kabbalah: { lurianic_frame: "null", sefirot_resonances: [1, 2, 3, 4, 5] },
      },
    });
    const d = out["gematriaDeep"] as Record<string, unknown>;
    expect(d["_schema"]).toBe(2);
    expect(d["primary_lang"]).toBe("hebrew");
    expect((d["cross_matches"] as Array<{ matches: unknown[] }>)[0]?.matches).toHaveLength(6);
    expect(d["notarikon"]).toHaveLength(4);
    const k = d["kabbalah"] as Record<string, unknown>;
    expect(k["lurianic_frame"]).toBe(""); // "null" string → ""
    expect(k["sefirot_resonances"]).toHaveLength(4);
  });

  it("throws on non-objects", () => {
    expect(() => coercePanelData(null)).toThrow(/not an object/);
  });
});

describe("coerceExegesis", () => {
  it("defaults fields, stamps schema 2, and filters", () => {
    expect(coerceExegesis({})).toEqual({
      _schema: 2,
      key_terms: [],
      literary_structure: "",
      historical_context: "",
      intertextual_echoes: [],
      exegetical_options: [],
      preferred_reading: "",
      theological_implication: "",
      applicational_pivot: "",
    });
    const out = coerceExegesis({
      key_terms: [{ term: "logos" }, { junk: 1 }],
      intertextual_echoes: [{ ref: "gen.1.1" }, { x: 1 }],
    });
    expect(out["key_terms"]).toEqual([{ term: "logos" }]);
    expect(out["intertextual_echoes"]).toEqual([{ ref: "gen.1.1" }]);
  });
  it("throws on non-objects", () => {
    expect(() => coerceExegesis(null)).toThrow(/not an object/);
  });
});

describe("coerceTxAnalysis", () => {
  it("defaults fields, stamps schema 2, and filters renderings/divergences", () => {
    const out = coerceTxAnalysis({
      verse_ref: "jhn.1.1",
      renderings: [{ translation: "kjv", text: "In the beginning" }, { junk: 1 }],
      divergence_points: [{ issue: "logos" }, { x: 1 }],
    });
    expect(out["_schema"]).toBe(2);
    expect(out["verse_ref"]).toBe("jhn.1.1");
    expect(out["renderings"]).toEqual([{ translation: "kjv", text: "In the beginning" }]);
    expect(out["divergence_points"]).toEqual([{ issue: "logos" }]);
    expect(out["best_for_study"]).toBe("");
  });
  it("throws on non-objects", () => {
    expect(() => coerceTxAnalysis(undefined)).toThrow(/not an object/);
  });
});
