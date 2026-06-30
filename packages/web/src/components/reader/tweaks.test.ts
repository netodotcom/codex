// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { cxrTweaks, cxrSetTweak, CXR_TWEAKS_KEY } from "./tweaks.js";

// jsdom under vitest ships a non-functional localStorage; stub a real in-memory
// Storage (the repo-wide pattern).
function makeStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k: string) => (m.has(k) ? (m.get(k) as string) : null),
    key: (i: number) => [...m.keys()][i] ?? null,
    removeItem: (k: string) => void m.delete(k),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
  };
}

beforeEach(() => {
  vi.stubGlobal("localStorage", makeStorage());
});

describe("cxrTweaks", () => {
  it("reads the codex.tweaks.v1 store", () => {
    localStorage.setItem(CXR_TWEAKS_KEY, JSON.stringify({ divineGold: false, fontScale: 22 }));
    expect(cxrTweaks()).toEqual({ divineGold: false, fontScale: 22 });
  });

  it("returns {} when missing or corrupt", () => {
    expect(cxrTweaks()).toEqual({});
    localStorage.setItem(CXR_TWEAKS_KEY, "{not json");
    expect(cxrTweaks()).toEqual({});
  });
});

describe("cxrSetTweak", () => {
  it("persists the key and fires a tweakchange CustomEvent with the delta", () => {
    const seen: Array<Record<string, unknown>> = [];
    const handler = (e: Event) => seen.push((e as CustomEvent).detail);
    window.addEventListener("tweakchange", handler);
    cxrSetTweak("overlayGnosis", true);
    window.removeEventListener("tweakchange", handler);

    expect(cxrTweaks().overlayGnosis).toBe(true);
    expect(seen).toEqual([{ overlayGnosis: true }]);
  });

  it("merges onto existing tweaks without clobbering siblings", () => {
    localStorage.setItem(CXR_TWEAKS_KEY, JSON.stringify({ fontScale: 30 }));
    cxrSetTweak("divineHebrew", true);
    expect(cxrTweaks()).toEqual({ fontScale: 30, divineHebrew: true });
  });
});
