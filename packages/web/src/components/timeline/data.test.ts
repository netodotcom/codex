// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { ERAS, CATEGORIES, ERA_LOOKUP, CAT_LOOKUP, loadEvents, cachedEvents, type TimelineEvent } from "./data.js";

describe("era/category metadata", () => {
  it("has unique, looked-up eras and categories", () => {
    expect(ERAS.length).toBe(13);
    expect(CATEGORIES.length).toBe(8);
    expect(ERA_LOOKUP["primeval"]?.label).toBe("Primeval");
    expect(CAT_LOOKUP["war"]?.glyph).toBe("⚔");
    expect(new Set(ERAS.map((e) => e.id)).size).toBe(ERAS.length);
  });
});

describe("loadEvents", () => {
  it("loads via CODEX_MODULES, sorts by year, and caches", async () => {
    const raw: TimelineEvent[] = [
      { id: "b", year: 100, era: "apostolic", category: "writing", title: "Late" },
      { id: "a", year: -2000, era: "patriarchs", category: "narrative", title: "Early" },
    ];
    const loadModule = vi.fn(async () => ({ events: raw }));
    (window as unknown as { CODEX_MODULES?: unknown }).CODEX_MODULES = { loadModule };

    expect(cachedEvents()).toBeNull();
    const out = await loadEvents();
    expect(out.map((e) => e.id)).toEqual(["a", "b"]); // sorted ascending by year
    expect(cachedEvents()).toBe(out);

    // second call is served from cache — loadModule not called again
    const again = await loadEvents();
    expect(again).toBe(out);
    expect(loadModule).toHaveBeenCalledTimes(1);
  });
});
