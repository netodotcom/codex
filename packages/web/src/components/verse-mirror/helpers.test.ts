// @vitest-environment jsdom
// mirrorJumpRef reads window.codexJumpToRef — needs a DOM environment.
import { describe, it, expect, vi, beforeEach } from "vitest";
import { mirrorJumpRef, MIRROR_SCHEMA_V, MIRROR_PROMPT } from "./helpers.js";
import type { MirrorWindow } from "./verse-mirror-window.js";

function mwin(): MirrorWindow {
  return window as unknown as MirrorWindow;
}

beforeEach(() => {
  delete mwin().codexJumpToRef;
});

describe("MIRROR_SCHEMA_V (ground truth)", () => {
  it("is 2", () => {
    expect(MIRROR_SCHEMA_V).toBe(2);
  });
});

describe("MIRROR_PROMPT (ground truth)", () => {
  it("contains the required schema fields", () => {
    expect(MIRROR_PROMPT).toContain("historicalParallels");
    expect(MIRROR_PROMPT).toContain("modernResonances");
    expect(MIRROR_PROMPT).toContain("propheticReadings");
    expect(MIRROR_PROMPT).toContain("crossReferences");
    expect(MIRROR_PROMPT).toContain("caveats");
    expect(MIRROR_PROMPT).toContain("verseYear");
    expect(MIRROR_PROMPT).toContain("intensity");
    expect(MIRROR_PROMPT).toContain("contested");
  });
  it("instructs the AI not to add prose outside the JSON", () => {
    expect(MIRROR_PROMPT).toContain("No prose outside the JSON");
  });
});

describe("mirrorJumpRef (ground truth)", () => {
  it("calls the provided onJumpRef when it is a function", () => {
    const fn = vi.fn();
    mirrorJumpRef(fn, "John 3:16");
    expect(fn).toHaveBeenCalledOnce();
    expect(fn).toHaveBeenCalledWith("John 3:16");
  });

  it("does not call window.codexJumpToRef when onJumpRef is supplied", () => {
    const windowFn = vi.fn();
    mwin().codexJumpToRef = windowFn;
    const localFn = vi.fn();
    mirrorJumpRef(localFn, "Rev 1:1");
    expect(localFn).toHaveBeenCalledOnce();
    expect(windowFn).not.toHaveBeenCalled();
  });

  it("falls back to window.codexJumpToRef when onJumpRef is undefined", () => {
    const windowFn = vi.fn();
    mwin().codexJumpToRef = windowFn;
    mirrorJumpRef(undefined, "Gen 1:1");
    expect(windowFn).toHaveBeenCalledOnce();
    expect(windowFn).toHaveBeenCalledWith("Gen 1:1");
  });

  it("does nothing when both are absent", () => {
    // No onJumpRef, no window.codexJumpToRef — should not throw.
    expect(() => mirrorJumpRef(undefined, "Ps 23:1")).not.toThrow();
  });
});
