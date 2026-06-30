// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import "./index.js"; // side-effect: Object.assign(window, { CODEX_HelpWiki })
import { HelpWiki } from "./HelpWiki.js";

describe("help entry (index.tsx)", () => {
  it("exposes window.CODEX_HelpWiki as the HelpWiki component", () => {
    const exported = (window as unknown as { CODEX_HelpWiki?: unknown }).CODEX_HelpWiki;
    expect(exported).toBe(HelpWiki);
  });
});
