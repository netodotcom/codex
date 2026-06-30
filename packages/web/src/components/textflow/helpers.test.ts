// textflow — pure-logic tests for textflowParse and TEXTFLOW_TRACTATES.
// Ground truth captured by tracing the exact legacy algorithm.
// Node environment (no jsdom needed — no DOM access).
import { describe, it, expect } from "vitest";
import { textflowParse, TEXTFLOW_TRACTATES } from "./helpers.js";

describe("TEXTFLOW_TRACTATES", () => {
  it("contains 38 tractates matching the Babylonian Talmud standard list", () => {
    expect(TEXTFLOW_TRACTATES.length).toBe(38);
    expect(TEXTFLOW_TRACTATES[0]).toBe("Berakhot");
    expect(TEXTFLOW_TRACTATES[TEXTFLOW_TRACTATES.length - 1]).toBe("Niddah");
  });
});

describe("textflowParse", () => {
  it("returns null for empty string", () => {
    expect(textflowParse("")).toBeNull();
  });

  it("returns null for null / undefined / 0 (falsy — String(x || '') → '')", () => {
    expect(textflowParse(null)).toBeNull();
    expect(textflowParse(undefined)).toBeNull();
    // 0 is falsy: 0 || "" → "" → trimmed to "" → null
    expect(textflowParse(0)).toBeNull();
  });

  it("parses exact tractate name + folio", () => {
    expect(textflowParse("Berakhot 2a")).toEqual({
      kind: "sefaria",
      tref: "Berakhot.2a",
      label: "Berakhot 2a",
    });
  });

  it("parses talmud-dot-prefixed spec", () => {
    expect(textflowParse("talmud.Berakhot.2a")).toEqual({
      kind: "sefaria",
      tref: "Berakhot.2a",
      label: "Berakhot 2a",
    });
  });

  it("parses talmud-space-prefixed spec", () => {
    expect(textflowParse("talmud Berakhot 2a")).toEqual({
      kind: "sefaria",
      tref: "Berakhot.2a",
      label: "Berakhot 2a",
    });
  });

  it("is case-insensitive on tractate name (folio casing preserved from input)", () => {
    expect(textflowParse("berakhot 2a")).toEqual({
      kind: "sefaria",
      tref: "Berakhot.2a",
      label: "Berakhot 2a",
    });
    // folio part is taken verbatim from the match — "2A" is preserved as-is
    expect(textflowParse("BERAKHOT 2A")).toEqual({
      kind: "sefaria",
      tref: "Berakhot.2A",
      label: "Berakhot 2A",
    });
  });

  it("matches by prefix when exact name not found", () => {
    expect(textflowParse("Berakh 2a")).toEqual({
      kind: "sefaria",
      tref: "Berakhot.2a",
      label: "Berakhot 2a",
    });
  });

  it("parses folio with 'b' suffix", () => {
    expect(textflowParse("Shabbat 7b")).toEqual({
      kind: "sefaria",
      tref: "Shabbat.7b",
      label: "Shabbat 7b",
    });
  });

  it("parses multi-word tractate (Rosh Hashanah)", () => {
    expect(textflowParse("Rosh Hashanah 2a")).toEqual({
      kind: "sefaria",
      tref: "Rosh Hashanah.2a",
      label: "Rosh Hashanah 2a",
    });
  });

  it("parses Bava tractates", () => {
    expect(textflowParse("Bava Kamma 3b")).toEqual({
      kind: "sefaria",
      tref: "Bava Kamma.3b",
      label: "Bava Kamma 3b",
    });
  });

  it("returns null for talmud-prefixed but unresolvable tractate", () => {
    expect(textflowParse("talmud.xyz.999")).toBeNull();
    expect(textflowParse("talmud something")).toBeNull();
  });

  it("returns null for bare 'talmud' (no following tractate)", () => {
    // "talmud" has no [.\s]+ suffix so the prefix-strip doesn't fire;
    // cleaned = "talmud", no digit+folio match, /^talmud\b/ fires → null.
    expect(textflowParse("talmud")).toBeNull();
  });

  it("returns a bible ref for non-talmud, non-tractate strings", () => {
    expect(textflowParse("John 3:16")).toEqual({ kind: "bible", ref: "John 3:16" });
    expect(textflowParse("Genesis 1")).toEqual({ kind: "bible", ref: "Genesis 1" });
    expect(textflowParse("  John 3:16  ")).toEqual({ kind: "bible", ref: "John 3:16" });
  });

  it("returns a bible ref for an unknown tractate name without talmud prefix", () => {
    // "Foobar 2a" — tractate not found, no talmud prefix → bible ref
    expect(textflowParse("Foobar 2a")).toEqual({ kind: "bible", ref: "Foobar 2a" });
  });
});
