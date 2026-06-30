import { describe, it, expect } from "vitest";
import { detectLang, strip, all, hebrew, greek, english } from "./gematria.js";

// Ground-truth values captured by running the original gematria.js in Node,
// so the TS port is provably faithful (see git history / RELATORIO notes).

describe("detectLang", () => {
  it("classifies by script, defaulting to english", () => {
    expect(detectLang("abc")).toBe("english");
    expect(detectLang("λόγος")).toBe("greek");
    expect(detectLang("אהבה")).toBe("hebrew");
    expect(detectLang("")).toBe("english");
  });
});

describe("strip", () => {
  it("removes combining marks (NFD)", () => {
    expect(strip("λόγος")).toBe("λογος");
    // pointed Hebrew collapses to its consonantal skeleton
    expect(strip("אַהֲבָה")).toBe("אהבה");
  });
});

describe("english systems", () => {
  it("computes ordinal / reduction / reverse", () => {
    expect(english.ordinal("Jesus")).toBe(74);
    expect(english.reduction("Jesus")).toBe(11);
    expect(english.reverse("Jesus")).toBe(61);
  });
  it("ignores non a–z characters", () => {
    expect(english.ordinal("a-b!c")).toBe(english.ordinal("abc"));
  });
});

describe("hebrew systems", () => {
  it("hechrachi sums base values", () => {
    expect(hebrew.hechrachi("אהבה")).toBe(13);
    expect(hebrew.hechrachi("שלום")).toBe(376);
  });
  it("gadol lifts final letters (שלום → 936, vs 376)", () => {
    expect(hebrew.gadol("שלום")).toBe(936);
  });
  it("ignores niqqud (pointed = unpointed)", () => {
    expect(hebrew.hechrachi("אַהֲבָה")).toBe(13);
  });
});

describe("greek systems", () => {
  it("isopsephy of λόγος is 373", () => {
    expect(greek.isopsephy("λόγος")).toBe(373);
    expect(greek.ordinal("λόγος")).toBe(62);
    expect(greek.reduced("λόγος")).toBe(4);
  });
});

describe("all() bundle", () => {
  it("greek: λόγος", () => {
    expect(all("λόγος")).toEqual({ lang: "greek", isopsephy: 373, ordinal: 62, reduced: 4 });
  });

  it("hebrew: אהבה (love = 13)", () => {
    expect(all("אהבה")).toEqual({
      lang: "hebrew",
      hechrachi: 13,
      gadol: 13,
      sidduri: 13,
      katan: 13,
      katan_mispari: 4,
      boneh: 28,
      kidmi: 34,
      atbash: { transformed: "תצשצ", value: 880 },
      albam: { transformed: "לעמע", value: 210 },
      neelam: 522,
      haakhor: 37,
    });
  });

  it("hebrew: שלום (peace, finals)", () => {
    expect(all("שלום")).toEqual({
      lang: "hebrew",
      hechrachi: 376,
      gadol: 936,
      sidduri: 52,
      katan: 16,
      katan_mispari: 7,
      boneh: 1342,
      kidmi: 46456,
      atbash: { transformed: "בכפי", value: 112 },
      albam: { transformed: "יאפ", value: 91 },
      neelam: 110,
      haakhor: 538,
    });
  });

  it("english: Jesus", () => {
    expect(all("Jesus")).toEqual({ lang: "english", ordinal: 74, reduction: 11, reverse: 61 });
  });

  it("honours an explicit language override", () => {
    expect(all("abc", "greek").lang).toBe("greek");
  });
});
