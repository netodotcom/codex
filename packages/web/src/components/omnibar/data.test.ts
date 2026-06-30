import { describe, it, expect } from "vitest";
import {
  OMNI_VERBS,
  PANEL_INDEX,
  OMNI_STOP,
  OMNI_FREQ_KEY,
  omniNorm,
  omniWords,
} from "./data.js";

describe("omniNorm (ground truth)", () => {
  it("lowercases and strips every non-alphanumeric", () => {
    expect(omniNorm("John 3:16")).toBe("john316");
    expect(omniNorm("CROSS-REFS")).toBe("crossrefs");
  });
  it("drops non-ASCII glyphs entirely", () => {
    expect(omniNorm("Α/Ω")).toBe("");
  });
});

describe("omniWords (ground truth)", () => {
  it("word-preserves: non-alphanumeric runs become single spaces, trimmed", () => {
    expect(omniWords("Open the MAP!")).toBe("open the map");
    expect(omniWords("  a.b,,c  ")).toBe("a b c");
  });
  it("guards null/undefined to empty string", () => {
    expect(omniWords(null)).toBe("");
    expect(omniWords(undefined)).toBe("");
  });
});

describe("static index integrity", () => {
  it("keeps the 7 verbs with their kinds", () => {
    expect(Object.keys(OMNI_VERBS)).toEqual(["sword", "mirror", "map", "art", "compare", "go", "ops"]);
    expect(OMNI_VERBS["go"]?.kind).toBe("go");
    expect(OMNI_VERBS["ops"]?.kind).toBe("ops");
    expect(OMNI_VERBS["sword"]?.kind).toBe("console");
  });
  it("keeps all 23 panel rows, ids unique", () => {
    expect(PANEL_INDEX.length).toBe(23);
    expect(new Set(PANEL_INDEX.map((p) => p.id)).size).toBe(23);
    expect(PANEL_INDEX[0]).toMatchObject({ id: "trans", label: "TRANSLATIONS", icon: "Α/Ω" });
  });
  it("freezes the freq key and the stop-word set", () => {
    expect(OMNI_FREQ_KEY).toBe("codex.cmd.freq.v1");
    expect(OMNI_STOP.has("the")).toBe(true);
    expect(OMNI_STOP.has("map")).toBe(false);
  });
});
