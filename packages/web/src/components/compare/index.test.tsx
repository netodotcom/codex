// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";

interface IndexWindow {
  CODEX_PLUGINS_API?: { register: (p: unknown) => unknown };
  CODEX_ComparePanel?: unknown;
}

const iw = (): IndexWindow => window as unknown as IndexWindow;

interface RegisteredPlugin {
  id: string;
  name: string;
  version: string;
  panels: Array<{ id: string; label: string; glyph: string }>;
}

describe("compare index (export contract + plugin registration)", () => {
  it("sets CODEX_ComparePanel and registers the compare plugin on import", async () => {
    const register = vi.fn(() => true);
    iw().CODEX_PLUGINS_API = { register };

    await import("./index.js");

    // The frozen export contract: window.CODEX_ComparePanel is a React component
    expect(typeof iw().CODEX_ComparePanel).toBe("function");

    // Plugin registered exactly once with the legacy ids
    expect(register).toHaveBeenCalledTimes(1);
    const plugin = (register.mock.calls[0]! as unknown[])[0] as RegisteredPlugin;
    expect(plugin.id).toBe("compare");
    expect(plugin.name).toBe("How CODEX Compares");
    expect(plugin.version).toBe("1.0.0");
    expect(plugin.panels[0]!.id).toBe("compare");
    expect(plugin.panels[0]!.label).toBe("COMPARE");
    expect(plugin.panels[0]!.glyph).toBe("⚖");
  });
});
