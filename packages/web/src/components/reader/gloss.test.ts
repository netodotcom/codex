// Ground truth captured by running the ORIGINAL reader.jsx cxrGlossAnchor in node
// (faithful copy) before migration.
import { describe, it, expect } from "vitest";
import { cxrGlossAnchor, CXR_OVERLAYS } from "./gloss.js";

describe("cxrGlossAnchor", () => {
  it("anchors a 'v. N' hint within range", () => {
    expect(cxrGlossAnchor({ body: "v. 14 — the Word made flesh" }, 1, 51)).toBe(14);
  });

  it("anchors the first verse of a 'vv. N-M' range", () => {
    expect(cxrGlossAnchor({ ref: "vv. 12-13", body: "x" }, 1, 51)).toBe(12);
  });

  it("anchors 'ch:v' only when ch names THIS chapter", () => {
    expect(cxrGlossAnchor({ heading: "see 1:11 here" }, 1, 51)).toBe(11);
    expect(cxrGlossAnchor({ heading: "see 2:11 here" }, 1, 51)).toBeNull();
  });

  it("returns null for unanchored prose", () => {
    expect(cxrGlossAnchor({ body: "no anchor at all" }, 1, 51)).toBeNull();
  });

  it("rejects a verse hint beyond the chapter's verse count", () => {
    expect(cxrGlossAnchor({ body: "v. 99 beyond range" }, 1, 51)).toBeNull();
  });

  it("anchors from the ref field too", () => {
    expect(cxrGlossAnchor({ ref: "v. 3" }, 1, 51)).toBe(3);
  });
});

describe("CXR_OVERLAYS", () => {
  it("declares gnosis, talmud, comm with their tweak keys", () => {
    expect(CXR_OVERLAYS.map((o) => o.k)).toEqual(["gnosis", "talmud", "comm"]);
    expect(CXR_OVERLAYS.map((o) => o.tweak)).toEqual([
      "overlayGnosis",
      "overlayTalmud",
      "overlayCommentary",
    ]);
    expect(CXR_OVERLAYS.map((o) => o.glyph)).toEqual(["⟁", "ת", "§"]);
  });
});
