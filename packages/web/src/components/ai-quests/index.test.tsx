// @vitest-environment jsdom
// Verify that importing index.tsx sets the exact same window globals the legacy
// IIFE set and registers the plugin under the correct id / panel spec.
import { describe, it, expect, vi, beforeEach } from "vitest";

interface AiQuestsIndexWindow {
  CODEX_PLUGINS_API?: { register: (p: unknown) => unknown };
  CODEX_QUESTS?: Array<{
    id: string;
    glyph: string;
    title: string;
    blurb: string;
    run: () => void;
  }>;
  CODEX_AI_QUESTS?: {
    launchCatalog: unknown;
    launchRunner: unknown;
    generateQuest: unknown;
    generateFeedback: unknown;
  };
}
const iw = (): AiQuestsIndexWindow => window as unknown as AiQuestsIndexWindow;

// Install in-memory localStorage so hasAiKey / lsGet calls don't throw.
beforeEach(() => {
  const store: Record<string, string> = {};
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string): string | null =>
        Object.prototype.hasOwnProperty.call(store, k) ? (store[k] ?? null) : null,
      setItem: (k: string, v: string): void => { store[k] = String(v); },
      removeItem: (k: string): void => { delete store[k]; },
      clear: (): void => { for (const k of Object.keys(store)) delete store[k]; },
    },
  });
});

describe("ai-quests index — window globals + plugin registration", () => {
  it("registers the plugin and sets CODEX_QUESTS + CODEX_AI_QUESTS", async () => {
    const register = vi.fn(() => true);
    iw().CODEX_PLUGINS_API = { register };

    await import("./index.js");

    // Plugin registered exactly once.
    expect(register).toHaveBeenCalledTimes(1);
    const plugin = (register.mock.calls[0]! as unknown[])[0] as {
      id: string;
      name: string;
      version: string;
      panels: Array<{ id: string; label: string; glyph: string }>;
    };
    expect(plugin.id).toBe("ai-quests");
    expect(plugin.name).toBe("AI Study Quests");
    expect(plugin.version).toBe("1.0.0");
    expect(plugin.panels[0]!.id).toBe("quests");
    expect(plugin.panels[0]!.label).toBe("QUESTS");
    expect(plugin.panels[0]!.glyph).toBe("⚔");

    // CODEX_QUESTS catalog entry is present with correct id.
    expect(Array.isArray(iw().CODEX_QUESTS)).toBe(true);
    const entry = iw().CODEX_QUESTS!.find((q) => q.id === "ai-quests-catalog");
    expect(entry).toBeDefined();
    expect(entry!.glyph).toBe("⚔");
    expect(typeof entry!.run).toBe("function");

    // Public API surface matches legacy window.CODEX_AI_QUESTS.
    const api = iw().CODEX_AI_QUESTS!;
    expect(typeof api.launchCatalog).toBe("function");
    expect(typeof api.launchRunner).toBe("function");
    expect(typeof api.generateQuest).toBe("function");
    expect(typeof api.generateFeedback).toBe("function");
  });
});
