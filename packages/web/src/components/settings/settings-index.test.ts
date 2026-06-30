// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from "vitest";
import { unknownTweaks, refreshSettingsIndex, migrateEngage } from "./settings-index.js";
import { CODEX_TWEAKS_KEY } from "./store.js";

interface TestWindow {
  CODEX_TWEAK_DEFAULTS?: Record<string, unknown>;
  CODEX_SETTINGS_INDEX?: Array<{ key: string }>;
}

// The test runner's global localStorage is node's broken experimental shim;
// stub a real in-memory Storage so the store helpers behave like a browser.
function makeStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() {
      return m.size;
    },
    clear: () => m.clear(),
    getItem: (k: string) => (m.has(k) ? (m.get(k) as string) : null),
    key: (i: number) => [...m.keys()][i] ?? null,
    removeItem: (k: string) => void m.delete(k),
    setItem: (k: string, v: string) => void m.set(k, String(v)),
  };
}

beforeEach(() => {
  vi.stubGlobal("localStorage", makeStorage());
  delete (window as unknown as TestWindow).CODEX_TWEAK_DEFAULTS;
  delete (window as unknown as TestWindow).CODEX_SETTINGS_INDEX;
});

describe("unknownTweaks", () => {
  it("surfaces stored/default keys the registry doesn't know, skipping deprecated", () => {
    (window as unknown as TestWindow).CODEX_TWEAK_DEFAULTS = { myCustomFlag: true, yhwhMode: true };
    localStorage.setItem(CODEX_TWEAKS_KEY, JSON.stringify({ anotherOne: 7 }));
    const out = unknownTweaks();
    const keys = out.map((e) => e.key);
    expect(keys).toContain("myCustomFlag");
    expect(keys).toContain("anotherOne");
    expect(keys).not.toContain("yhwhMode"); // deprecated
    expect(keys).not.toContain("fontScale"); // known in registry
    const flag = out.find((e) => e.key === "myCustomFlag");
    expect(flag?.kind).toBe("toggle");
    const num = out.find((e) => e.key === "anotherOne");
    expect(num?.kind).toBe("number");
  });
});

describe("refreshSettingsIndex", () => {
  it("publishes a flat index of registry + unknown entries to window", () => {
    (window as unknown as TestWindow).CODEX_TWEAK_DEFAULTS = { surpriseKey: "hi" };
    const idx = refreshSettingsIndex();
    expect(idx.some((e) => e.key === "fontScale")).toBe(true);
    expect(idx.some((e) => e.key === "surpriseKey")).toBe(true);
    expect((window as unknown as TestWindow).CODEX_SETTINGS_INDEX).toBe(idx);
    // shape is {key,label,kind,group} only
    expect(Object.keys(idx[0] ?? {}).sort()).toEqual(["group", "key", "kind", "label"]);
  });
});

describe("migrateEngage", () => {
  it("copies legacy engage* choices to the canonical continuity keys once", () => {
    localStorage.setItem(CODEX_TWEAKS_KEY, JSON.stringify({ engageEnabled: false, engageDailyThreshold: 3, engageNotifyCadence: "all" }));
    migrateEngage();
    const s = JSON.parse(localStorage.getItem(CODEX_TWEAKS_KEY) || "{}");
    expect(s.continuityEnabled).toBe(false);
    expect(s.continuityThreshold).toBe(3);
    expect(s.notifyCadence).toBe("all");
  });
  it("does not overwrite an existing canonical value", () => {
    localStorage.setItem(CODEX_TWEAKS_KEY, JSON.stringify({ engageEnabled: true, continuityEnabled: false }));
    migrateEngage();
    const s = JSON.parse(localStorage.getItem(CODEX_TWEAKS_KEY) || "{}");
    expect(s.continuityEnabled).toBe(false);
  });
});
