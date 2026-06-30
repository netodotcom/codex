// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";

interface IndexWindow {
  CODEX_PLUGINS_API?: { register: (p: unknown) => unknown };
  CODEX_CrossRefPanel?: unknown;
  CODEX_CrossRefLookup?: {
    getCrossRefs?: unknown;
    formatRef?: unknown;
    parseVerseKey?: (k: unknown) => unknown;
  };
}
const iw = (): IndexWindow => window as unknown as IndexWindow;

interface RegisteredPlugin {
  id: string;
  name: string;
  version: string;
  panels: Array<{ id: string; label: string; glyph: string }>;
  verseActions: Array<{ label: string; icon: string }>;
}

describe("crossref index (export contract + plugin registration)", () => {
  it("sets the frozen window globals and registers the TSK plugin on import", async () => {
    const register = vi.fn(() => true);
    iw().CODEX_PLUGINS_API = { register };

    await import("./index.js");

    // plugin registered once, with the frozen ids / labels
    expect(register).toHaveBeenCalledTimes(1);
    const plugin = (register.mock.calls[0]! as unknown[])[0] as RegisteredPlugin;
    expect(plugin.id).toBe("crossrefs-tsk");
    expect(plugin.version).toBe("2.0.0");
    expect(plugin.panels[0]!.id).toBe("crossrefs");
    expect(plugin.panels[0]!.label).toBe("CROSS-REFS");
    expect(plugin.panels[0]!.glyph).toBe("✝");
    expect(plugin.verseActions[0]!.label).toBe("Cross-References");

    // the export contract: window.CODEX_CrossRefPanel + window.CODEX_CrossRefLookup
    expect(typeof iw().CODEX_CrossRefPanel).toBe("function");
    const lookup = iw().CODEX_CrossRefLookup!;
    expect(typeof lookup.getCrossRefs).toBe("function");
    expect(typeof lookup.formatRef).toBe("function");
    expect(typeof lookup.parseVerseKey).toBe("function");
    // the exposed parseVerseKey is the faithful one
    expect(lookup.parseVerseKey!("jhn.3.16")).toEqual({ bookId: "jhn", chapter: 3, verse: 16 });
  });
});
