// @vitest-environment jsdom
import { describe, it, expect } from "vitest";

interface IndexWindow {
  VerseMenu?: unknown;
}
const iw = (): IndexWindow => window as unknown as IndexWindow;

describe("verse-menu index — export contract + CSS injection", () => {
  it("sets window.VerseMenu to the React component and injects the stylesheet", async () => {
    await import("./index.js");

    // window.VerseMenu is now the React component (a function).
    expect(typeof iw().VerseMenu).toBe("function");

    // CSS stylesheet injected with the correct id (idempotent guard).
    const styleEl = document.getElementById("cx-vm-min-style");
    expect(styleEl).not.toBeNull();
    expect(styleEl?.tagName.toLowerCase()).toBe("style");
  });

  it("the injected stylesheet contains the expected class rules", () => {
    const styleEl = document.getElementById("cx-vm-min-style");
    const text = styleEl?.textContent ?? "";
    expect(text).toContain("cx-vm-min");
    expect(text).toContain("cx-vm-verbs");
    expect(text).toContain("cx-vm-verb");
  });
});
