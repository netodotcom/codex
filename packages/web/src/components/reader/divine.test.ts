// Ground truth captured by running the ORIGINAL reader.jsx cxrDivineSegment in
// node (faithful copy) before migration. These exact outputs must not drift.
import { describe, it, expect } from "vitest";
import { cxrDivineSegment, CXR_DIVINE_RULES } from "./divine.js";

describe("cxrDivineSegment", () => {
  it("gilds the Tetragrammaton (LORD) tetra and God name, in order", () => {
    expect(cxrDivineSegment("And the LORD God called")).toEqual([
      { t: "And the ", kind: null },
      { t: "LORD", kind: "tetra" },
      { t: " ", kind: null },
      { t: "God", kind: "name" },
      { t: " called", kind: null },
    ]);
  });

  it("gilds a bare God as name", () => {
    expect(cxrDivineSegment("In the beginning God created the heaven")).toEqual([
      { t: "In the beginning ", kind: null },
      { t: "God", kind: "name" },
      { t: " created the heaven", kind: null },
    ]);
  });

  it("keeps the possessive God's intact", () => {
    expect(cxrDivineSegment("God's own Son")).toEqual([
      { t: "God's", kind: "name" },
      { t: " own Son", kind: null },
    ]);
  });

  it("never gilds lowercase gods / godly", () => {
    expect(cxrDivineSegment("gods many and godly people")).toEqual([
      { t: "gods many and godly people", kind: null },
    ]);
  });

  it("leaves narrative prose untouched", () => {
    expect(cxrDivineSegment("Jesus answered and said")).toEqual([
      { t: "Jesus answered and said", kind: null },
    ]);
  });

  it("returns a single empty null segment for empty input", () => {
    expect(cxrDivineSegment("")).toEqual([{ t: "", kind: null }]);
    expect(cxrDivineSegment(undefined)).toEqual([{ t: "", kind: null }]);
    expect(cxrDivineSegment(null)).toEqual([{ t: "", kind: null }]);
  });

  it("gilds Hebrew Tetragrammaton + Elohim", () => {
    expect(cxrDivineSegment("יהוה אלהים")).toEqual([
      { t: "יהוה", kind: "tetra" },
      { t: " ", kind: null },
      { t: "אלהים", kind: "name" },
    ]);
  });

  it("treats all-caps SENHOR (Portuguese) as tetra", () => {
    expect(cxrDivineSegment("the SENHOR is my shepherd")).toEqual([
      { t: "the ", kind: null },
      { t: "SENHOR", kind: "tetra" },
      { t: " is my shepherd", kind: null },
    ]);
  });

  it("handles Spanish Jehová (tetra) + Dios (name)", () => {
    expect(cxrDivineSegment("Yo soy Jehová tu Dios")).toEqual([
      { t: "Yo soy ", kind: null },
      { t: "Jehová", kind: "tetra" },
      { t: " tu ", kind: null },
      { t: "Dios", kind: "name" },
    ]);
  });

  it("exposes the rule table", () => {
    expect(CXR_DIVINE_RULES.length).toBe(17);
    expect(CXR_DIVINE_RULES.every((r) => r.kind === "tetra" || r.kind === "name")).toBe(true);
  });
});
