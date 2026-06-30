import { describe, it, expect } from "vitest";
import { escapeHtml, poiPopupHtml, touristPopupHtml } from "./popups.js";

describe("escapeHtml", () => {
  it("escapes the five HTML-significant characters", () => {
    expect(escapeHtml(`<a href="x" id='y'>&`)).toBe("&lt;a href=&quot;x&quot; id=&#39;y&#39;&gt;&amp;");
    expect(escapeHtml(undefined)).toBe("");
  });
});

describe("poiPopupHtml", () => {
  it("renders glyph, escaped name, kind and a BCE/CE year range", () => {
    const html = poiPopupHtml({ name: "Jeru<b>", kind: "city", from: -1000, to: 500, wiki: "Jerusalem" });
    expect(html).toContain("▣"); // city glyph
    expect(html).toContain("Jeru&lt;b&gt;");
    expect(html).toContain("CITY");
    expect(html).toContain("1000 BCE – 500 CE");
    expect(html).toContain('data-wiki="Jerusalem"');
  });
  it("omits the year range when from/to are missing", () => {
    expect(poiPopupHtml({ name: "Nowhere", kind: "ruin" })).not.toContain("cx-poi-pop-yr");
  });
});

describe("touristPopupHtml", () => {
  it("renders meta, things, refs and the play button", () => {
    const html = touristPopupHtml({
      name: "Temple Mount",
      era: "Second Temple",
      distance_km: 1.23,
      summary: "holy",
      things_to_see: ["Western Wall"],
      biblical_refs: ["2chr.3.1"],
    });
    expect(html).toContain("Temple Mount");
    expect(html).toContain("Second Temple · 1.2 km");
    expect(html).toContain("<li>Western Wall</li>");
    expect(html).toContain("<code>2chr.3.1</code>");
    expect(html).toContain("▶ PLAY TOUR");
  });
});
