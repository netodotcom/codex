// @vitest-environment jsdom
// Verifies that importing the index sets the frozen window globals and registers
// the "jewish-study" plugin via CODEX_PLUGINS_API — identical contract to the
// legacy IIFE (same ids, labels, glyph, window globals).
import { describe, it, expect, vi } from "vitest";

interface IndexWindow {
  CODEX_PLUGINS_API?: { register: (p: unknown) => unknown };
  CODEX_JEWISH?: {
    currentParsha?: () => unknown;
    nextHoliday?: () => unknown;
    hebrewDate?: (d?: Date) => unknown;
  };
  CODEX_JewishStudyPanel?: unknown;
}
const iw = (): IndexWindow => window as unknown as IndexWindow;

interface RegisteredPlugin {
  id: string;
  name: string;
  version: string;
  panels: Array<{ id: string; label: string; glyph: string }>;
}

describe("jewish-study index (export contract + plugin registration)", () => {
  it("sets the frozen window globals and registers the plugin on import", async () => {
    const register = vi.fn(() => true);
    iw().CODEX_PLUGINS_API = { register };

    await import("./index.js");

    // Plugin registered exactly once with the frozen contract.
    expect(register).toHaveBeenCalledTimes(1);
    const plugin = (register.mock.calls[0]! as unknown[])[0] as RegisteredPlugin;
    expect(plugin.id).toBe("jewish-study");
    expect(plugin.name).toBe("Jewish Study Tools");
    expect(plugin.version).toBe("1.0.0");
    expect(plugin.panels[0]!.id).toBe("torah");
    expect(plugin.panels[0]!.label).toBe("TORAH");
    expect(plugin.panels[0]!.glyph).toBe("ה");

    // The two frozen window globals.
    const jewish = iw().CODEX_JEWISH;
    expect(typeof jewish?.currentParsha).toBe("function");
    expect(typeof jewish?.nextHoliday).toBe("function");
    expect(typeof jewish?.hebrewDate).toBe("function");

    expect(typeof iw().CODEX_JewishStudyPanel).toBe("function");
  });

  it("hebrewDate() returns an approximate Hebrew date object for a given Date", async () => {
    // CODEX_JEWISH_MONTHS_CACHE is absent — hebrewDate will try to load the
    // calendar module; since CODEX_MODULES is not set, loadModule rejects and
    // the Promise rejects too. But we can pre-set the months cache so the
    // sync path is taken.
    const months = [{ n: 7, name: "תִּשְׁרֵי", translit: "Tishrei" }];
    (window as unknown as { CODEX_JEWISH_MONTHS_CACHE: typeof months }).CODEX_JEWISH_MONTHS_CACHE = months;

    const jewish = iw().CODEX_JEWISH;
    const h = await jewish!.hebrewDate!(new Date(2024, 8, 20));
    const hDate = h as { day: number; month: { n: number }; year: number };
    expect(hDate.day).toBe(6);
    expect(hDate.month.n).toBe(7); // Tishrei
    expect(hDate.year).toBe(5785);
  });
});
