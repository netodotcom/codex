// @vitest-environment jsdom
// Pure helpers — localStorage + window.CODEX_ENGAGE are available in jsdom.
import { describe, it, expect, beforeEach } from "vitest";
import {
  mobFreqLoad,
  mobFreqRecord,
  mobFreqScore,
  mobIso,
  mobStreak,
  mobTrailRef,
  mobOrbPos,
  mobResolvePanel,
  MOB_ORB_KEY,
  MOB_FREQ_KEY,
} from "./helpers.js";
import type { StreakData } from "./mobile-window.js";

// ── localStorage mock (jsdom ships one but let's be explicit) ─────────────
function installStorage(): void {
  const store: Record<string, string> = {};
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) => (Object.prototype.hasOwnProperty.call(store, k) ? store[k]! : null),
      setItem: (k: string, v: string) => { store[k] = String(v); },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    },
  });
}

interface TestWindow {
  CODEX_ENGAGE?: { loadStreak?: () => StreakData | null };
  CODEX_PLUGINS_API?: { getPanels?: () => Array<{ pluginId: string; id: string; glyph?: string; label?: string }> };
}
const tw = (): TestWindow => window as unknown as TestWindow;

beforeEach(() => {
  installStorage();
  localStorage.clear();
  delete tw().CODEX_ENGAGE;
  delete tw().CODEX_PLUGINS_API;
});

// ── mobFreqLoad ────────────────────────────────────────────────────────────
describe("mobFreqLoad", () => {
  it("returns empty map when storage is empty", () => {
    expect(mobFreqLoad()).toEqual({});
  });
  it("returns stored map", () => {
    localStorage.setItem(MOB_FREQ_KEY, JSON.stringify({ omni: { n: 3, last: 1000 } }));
    expect(mobFreqLoad()).toEqual({ omni: { n: 3, last: 1000 } });
  });
  it("returns empty map for invalid JSON", () => {
    localStorage.setItem(MOB_FREQ_KEY, "NOT_JSON");
    expect(mobFreqLoad()).toEqual({});
  });
});

// ── mobFreqRecord ──────────────────────────────────────────────────────────
describe("mobFreqRecord", () => {
  it("writes a new entry with n=1", () => {
    mobFreqRecord("omni");
    const m = mobFreqLoad();
    expect(m["omni"]?.n).toBe(1);
  });
  it("increments an existing entry", () => {
    mobFreqRecord("omni");
    mobFreqRecord("omni");
    expect(mobFreqLoad()["omni"]?.n).toBe(2);
  });
  it("does nothing for falsy id", () => {
    mobFreqRecord(null);
    mobFreqRecord(undefined);
    mobFreqRecord("");
    expect(mobFreqLoad()).toEqual({});
  });
});

// ── mobFreqScore ───────────────────────────────────────────────────────────
describe("mobFreqScore", () => {
  it("returns 0 for undefined", () => {
    expect(mobFreqScore(undefined)).toBe(0);
  });
  it("returns 0 for entry with n=0", () => {
    expect(mobFreqScore({ n: 0, last: Date.now() })).toBe(0);
  });
  it("returns positive for a fresh entry", () => {
    const score = mobFreqScore({ n: 5, last: Date.now() });
    expect(score).toBeGreaterThan(0);
    // n * 0.97^0 = 5 (approximately, within floating-point tolerance)
    expect(score).toBeCloseTo(5, 1);
  });
  it("decays over time — lower score for older entry", () => {
    const recent = mobFreqScore({ n: 5, last: Date.now() });
    const old = mobFreqScore({ n: 5, last: Date.now() - 30 * 86400000 }); // 30 days ago
    expect(old).toBeLessThan(recent);
  });
});

// ── mobIso ─────────────────────────────────────────────────────────────────
describe("mobIso", () => {
  it("formats a date as YYYY-MM-DD", () => {
    expect(mobIso(new Date(2024, 0, 5))).toBe("2024-01-05");   // Jan 5
    expect(mobIso(new Date(2024, 11, 31))).toBe("2024-12-31"); // Dec 31
  });
  it("zero-pads month and day", () => {
    expect(mobIso(new Date(2024, 2, 9))).toBe("2024-03-09"); // Mar 9
  });
});

// ── mobTrailRef ────────────────────────────────────────────────────────────
describe("mobTrailRef", () => {
  it("returns null when trail is empty", () => {
    expect(mobTrailRef()).toBeNull();
  });
  it("returns last ref from the trail", () => {
    localStorage.setItem("codex.trail", JSON.stringify([{ ref: "gen.1.1" }, { ref: "jhn.3.16" }]));
    expect(mobTrailRef()).toBe("jhn.3.16");
  });
  it("returns null when last entry has no ref", () => {
    localStorage.setItem("codex.trail", JSON.stringify([{ ref: "gen.1.1" }, { foo: "bar" }]));
    expect(mobTrailRef()).toBeNull();
  });
  it("returns null on invalid JSON", () => {
    localStorage.setItem("codex.trail", "INVALID");
    expect(mobTrailRef()).toBeNull();
  });
});

// ── mobOrbPos ─────────────────────────────────────────────────────────────
describe("mobOrbPos", () => {
  it("returns 'center' when storage is empty", () => {
    expect(mobOrbPos()).toBe("center");
  });
  it("returns 'left' or 'right' from storage", () => {
    localStorage.setItem(MOB_ORB_KEY, "left");
    expect(mobOrbPos()).toBe("left");
    localStorage.setItem(MOB_ORB_KEY, "right");
    expect(mobOrbPos()).toBe("right");
  });
  it("returns 'center' for invalid value", () => {
    localStorage.setItem(MOB_ORB_KEY, "invalid");
    expect(mobOrbPos()).toBe("center");
  });
});

// ── mobStreak ─────────────────────────────────────────────────────────────
describe("mobStreak", () => {
  it("returns 0 when CODEX_ENGAGE is not set", () => {
    expect(mobStreak()).toBe(0);
  });
  it("returns 0 when loadStreak returns null", () => {
    tw().CODEX_ENGAGE = { loadStreak: () => null };
    expect(mobStreak()).toBe(0);
  });
  it("returns streak.current when lastDate is today", () => {
    const today = mobIso(new Date());
    tw().CODEX_ENGAGE = { loadStreak: () => ({ current: 7, lastDate: today }) };
    expect(mobStreak()).toBe(7);
  });
  it("returns streak.current when lastDate is yesterday", () => {
    const yest = mobIso(new Date(Date.now() - 86400000));
    tw().CODEX_ENGAGE = { loadStreak: () => ({ current: 3, lastDate: yest }) };
    expect(mobStreak()).toBe(3);
  });
  it("returns 0 when streak is stale (2 days ago)", () => {
    const twoDaysAgo = mobIso(new Date(Date.now() - 2 * 86400000));
    tw().CODEX_ENGAGE = { loadStreak: () => ({ current: 5, lastDate: twoDaysAgo }) };
    expect(mobStreak()).toBe(0);
  });
});

// ── mobResolvePanel ────────────────────────────────────────────────────────
describe("mobResolvePanel", () => {
  it("returns null for non-plugin id", () => {
    expect(mobResolvePanel("library")).toBeNull();
    expect(mobResolvePanel(null)).toBeNull();
  });
  it("returns null when CODEX_PLUGINS_API is not set", () => {
    expect(mobResolvePanel("plugin:myplugin:mypanel")).toBeNull();
  });
  it("returns the matching panel from getPanels", () => {
    const panels = [
      { pluginId: "myplugin", id: "mypanel", glyph: "★", label: "MY PANEL" },
    ];
    tw().CODEX_PLUGINS_API = { getPanels: () => panels };
    const result = mobResolvePanel("plugin:myplugin:mypanel");
    expect(result).not.toBeNull();
    expect(result?.pluginId).toBe("myplugin");
    expect(result?.id).toBe("mypanel");
  });
  it("returns null when no matching panel", () => {
    tw().CODEX_PLUGINS_API = { getPanels: () => [] };
    expect(mobResolvePanel("plugin:missing:panel")).toBeNull();
  });
});
