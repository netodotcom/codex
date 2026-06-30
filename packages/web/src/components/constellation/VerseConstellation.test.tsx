// @vitest-environment jsdom
import React from "react";
import { render, screen, cleanup } from "@testing-library/react";
import { afterEach, describe, it, expect } from "vitest";
import { VerseConstellation } from "./VerseConstellation.js";

interface TestWindow {
  CODEX_MODULES?: { loadModule: (id: string) => Promise<unknown> };
  codexConstInspect?: (idx: number) => void;
  __CODEX_CONST_FLIGHT?: unknown;
  __CODEX_CONST_TRAIL?: unknown;
}
const tw = (): TestWindow => window as unknown as TestWindow;

afterEach(() => {
  cleanup();
  delete tw().CODEX_MODULES;
});

describe("VerseConstellation", () => {
  it("renders the indexing state, self-injects the dossier CSS, and installs the smoke hooks", () => {
    // a loader that never resolves keeps the galaxy in its INDEXING phase
    tw().CODEX_MODULES = { loadModule: () => new Promise<unknown>(() => {}) };
    render(<VerseConstellation onClose={() => {}} />);
    expect(screen.getByText(/INDEXING THE CANON/)).toBeTruthy();
    // idempotent, same id as the legacy useEffect
    expect(document.getElementById("cx-const-text-css")).not.toBeNull();
    // runtime side-effects the legacy fired on mount
    expect(typeof tw().codexConstInspect).toBe("function");
    expect(tw().__CODEX_CONST_FLIGHT).toBeTruthy();
    expect(tw().__CODEX_CONST_TRAIL).toBe(0);
  });

  it("falls to THE LOOM IS DARK when the module loader is unavailable", async () => {
    // no window.CODEX_MODULES → the load effect throws and is caught
    expect(tw().CODEX_MODULES).toBeUndefined();
    render(<VerseConstellation onClose={() => {}} />);
    expect(await screen.findByText(/THE LOOM IS DARK/)).toBeTruthy();
    expect(screen.getByText(/Module loader unavailable/)).toBeTruthy();
  });

  it("removes the smoke hooks on unmount", () => {
    tw().CODEX_MODULES = { loadModule: () => new Promise<unknown>(() => {}) };
    const { unmount } = render(<VerseConstellation onClose={() => {}} />);
    expect(typeof tw().codexConstInspect).toBe("function");
    unmount();
    expect(tw().codexConstInspect).toBeUndefined();
    expect(tw().__CODEX_CONST_FLIGHT).toBeUndefined();
  });
});
