// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import "./index.js"; // module-load side-effect: Object.assign(window, { VerseConstellation })

interface ExportWindow {
  VerseConstellation?: unknown;
}

describe("constellation index entry", () => {
  it("re-exposes window.VerseConstellation (same global as the legacy IIFE)", () => {
    expect(typeof (window as unknown as ExportWindow).VerseConstellation).toBe("function");
  });
});
