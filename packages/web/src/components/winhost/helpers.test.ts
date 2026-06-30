// @vitest-environment jsdom
// All winhost helpers depend on browser APIs (localStorage, document, window),
// so the full suite runs in jsdom.  Ground-truth values for winhostResolve
// were verified against a faithful copy of the original resolution logic.
//
// jsdom ships without a functional localStorage — install an in-memory stub
// (same pattern as VoxPanel.test.tsx in vox/).
import { describe, it, expect, beforeEach } from "vitest";
import {
  WINHOST_KEY,
  winhostLoad,
  winhostSave,
  winhostDesktop,
  winhostResolve,
} from "./helpers.js";
import type { WinEntry } from "./helpers.js";

function installStorage(): void {
  const store: Record<string, string> = {};
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string) =>
        Object.prototype.hasOwnProperty.call(store, k) ? store[k]! : null,
      setItem: (k: string, v: string) => { store[k] = String(v); },
      removeItem: (k: string) => { delete store[k]; },
      clear: () => { for (const k of Object.keys(store)) delete store[k]; },
    },
  });
}

interface HelperWindow {
  CODEX_PLUGINS_API?: {
    getPanels?: () => Array<{ pluginId: string; id: string; glyph?: string }>;
  };
}
const hw = (): HelperWindow => window as unknown as HelperWindow;

// ── localStorage helpers ───────────────────────────────────────────────────

describe("winhostLoad / winhostSave", () => {
  beforeEach(() => {
    installStorage();
    localStorage.removeItem(WINHOST_KEY);
  });

  it("returns [] when nothing is stored", () => {
    expect(winhostLoad()).toEqual([]);
  });

  it("returns [] when stored value is corrupt JSON", () => {
    localStorage.setItem(WINHOST_KEY, "not-json{{{");
    expect(winhostLoad()).toEqual([]);
  });

  it("round-trips a window list faithfully", () => {
    const list: WinEntry[] = [
      { id: "plugin:foo:bar", title: "FOO", glyph: "◉" },
      { id: "plugin:baz:qux" },
    ];
    winhostSave(list);
    expect(winhostLoad()).toEqual(list);
  });

  it("caps the stored list at 12 entries", () => {
    const list: WinEntry[] = Array.from({ length: 15 }, (_, i) => ({
      id: `plugin:p:${i}`,
    }));
    winhostSave(list);
    expect(winhostLoad()).toHaveLength(12);
  });
});

// ── winhostDesktop ─────────────────────────────────────────────────────────

describe("winhostDesktop", () => {
  it("returns false when body lacks .cx-os7", () => {
    // jsdom body has no cx-os7 class by default
    expect(winhostDesktop()).toBe(false);
  });

  it("returns false even with .cx-os7 when matchMedia is missing (node-like)", () => {
    document.body.classList.add("cx-os7");
    // jsdom's matchMedia is undefined → the try/catch returns false
    expect(winhostDesktop()).toBe(false);
    document.body.classList.remove("cx-os7");
  });
});

// ── winhostResolve ─────────────────────────────────────────────────────────

describe("winhostResolve", () => {
  beforeEach(() => {
    delete hw().CODEX_PLUGINS_API;
  });

  it("returns null for an empty id", () => {
    expect(winhostResolve("")).toBeNull();
  });

  it("returns null for a non-plugin id", () => {
    expect(winhostResolve("commentary")).toBeNull();
    expect(winhostResolve("talmud:tractate")).toBeNull();
  });

  it("returns null when CODEX_PLUGINS_API is not set", () => {
    expect(winhostResolve("plugin:foo:bar")).toBeNull();
  });

  it("returns null when getPanels is absent on the API", () => {
    hw().CODEX_PLUGINS_API = {};
    expect(winhostResolve("plugin:foo:bar")).toBeNull();
  });

  it("returns null when no panel matches", () => {
    hw().CODEX_PLUGINS_API = {
      getPanels: () => [{ pluginId: "other", id: "panel" }],
    };
    expect(winhostResolve("plugin:foo:bar")).toBeNull();
  });

  it("resolves a matching plugin:pluginId:panelId correctly", () => {
    const panel = { pluginId: "foo", id: "bar", glyph: "★" };
    hw().CODEX_PLUGINS_API = { getPanels: () => [panel] };
    expect(winhostResolve("plugin:foo:bar")).toEqual(panel);
  });

  it("resolves panel ids containing colons (parts.slice(2).join(':'))", () => {
    const panel = { pluginId: "foo", id: "sub:panel" };
    hw().CODEX_PLUGINS_API = { getPanels: () => [panel] };
    expect(winhostResolve("plugin:foo:sub:panel")).toEqual(panel);
  });

  it("returns null when getPanels throws", () => {
    hw().CODEX_PLUGINS_API = {
      getPanels: () => {
        throw new Error("boom");
      },
    };
    expect(winhostResolve("plugin:foo:bar")).toBeNull();
  });
});
