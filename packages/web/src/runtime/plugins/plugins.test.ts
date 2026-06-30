// @vitest-environment jsdom
// CODEX Plugins — faithful-port tests. Assertions are derived directly from
// the legacy/plugins.js behaviour; any mismatch is a regression in the port.
import { describe, it, expect, beforeAll, beforeEach } from "vitest";
import {
  registry, validate, isStr,
  register, list, getPanels, getVerseActions,
  dispatch, onNavigate, onVerseSelect,
  adoptPreRegistered,
} from "./helpers.js";

// ── Typed window slice for this test module ───────────────────────────────────
interface W {
  CODEX_PLUGINS: unknown[];
  CODEX_PLUGINS_API: {
    register(p: unknown): boolean;
    list(): unknown[];
    getPanels(): unknown[];
    getVerseActions(): unknown[];
    dispatch(name: string, detail: unknown): void;
    onNavigate(book: string, chapter: string): void;
    onVerseSelect(ref: unknown): void;
  };
}
const gw = (): W => window as unknown as W;

// ── Plugin factories ──────────────────────────────────────────────────────────
function makePlugin(id = "test-plugin"): Record<string, unknown> {
  return { id, name: `Plugin ${id}`, version: "1.0.0" };
}

function makePluginWithPanels(id = "panel-plugin"): Record<string, unknown> {
  return {
    id,
    name: `Panel Plugin ${id}`,
    version: "1.0.0",
    panels: [
      {
        id: "pane-1",
        label: "Panel One",
        glyph: "✦",
        render: (_ctx: unknown) => null,
      },
    ],
  };
}

function makePluginWithVerseActions(id = "verse-plugin"): Record<string, unknown> {
  return {
    id,
    name: `Verse Plugin ${id}`,
    version: "1.0.0",
    verseActions: [
      {
        label: "Do Thing",
        icon: "▸",
        handler: (_ref: unknown) => {},
      },
    ],
  };
}

// ── Test setup ────────────────────────────────────────────────────────────────
// Import index once to install the window globals (mirrors runtime boot).
beforeAll(async () => {
  // Pre-initialize the public array so index.ts sees it on first import.
  gw().CODEX_PLUGINS = [];
  await import("./index.js");
});

beforeEach(() => {
  // Reset shared state between tests.
  registry.clear();
  gw().CODEX_PLUGINS = [];
});

// ── isStr ─────────────────────────────────────────────────────────────────────
describe("isStr()", () => {
  it("returns true for non-empty strings", () => {
    expect(isStr("hello")).toBe(true);
    expect(isStr("x")).toBe(true);
  });

  it("returns false for empty string", () => {
    expect(isStr("")).toBe(false);
  });

  it("returns false for non-strings", () => {
    expect(isStr(0)).toBe(false);
    expect(isStr(null)).toBe(false);
    expect(isStr(undefined)).toBe(false);
    expect(isStr({})).toBe(false);
    expect(isStr([])).toBe(false);
  });
});

// ── validate ──────────────────────────────────────────────────────────────────
describe("validate()", () => {
  it("throws on null", () => {
    expect(() => validate(null)).toThrow("CODEX plugin: must be an object");
  });

  it("throws on non-object", () => {
    expect(() => validate("string")).toThrow("CODEX plugin: must be an object");
    expect(() => validate(42)).toThrow("CODEX plugin: must be an object");
  });

  it("throws when id is missing", () => {
    expect(() => validate({ name: "x", version: "1" })).toThrow(
      "CODEX plugin: missing `id`",
    );
  });

  it("throws when id is empty string", () => {
    expect(() => validate({ id: "", name: "x", version: "1" })).toThrow(
      "CODEX plugin: missing `id`",
    );
  });

  it("throws when name is missing", () => {
    expect(() => validate({ id: "x", version: "1" })).toThrow(
      "CODEX plugin: missing `name`",
    );
  });

  it("throws when version is missing", () => {
    expect(() => validate({ id: "x", name: "x" })).toThrow(
      "CODEX plugin: missing `version`",
    );
  });

  it("throws when panels is a non-array truthy value", () => {
    expect(() =>
      validate({ id: "x", name: "x", version: "1", panels: "bad" }),
    ).toThrow("CODEX plugin x: panels must be an array");
  });

  it("throws when verseActions is a non-array truthy value", () => {
    expect(() =>
      validate({ id: "x", name: "x", version: "1", verseActions: 42 }),
    ).toThrow("CODEX plugin x: verseActions must be an array");
  });

  it("passes when panels is undefined (omitted)", () => {
    expect(validate({ id: "x", name: "x", version: "1" })).toBe(true);
  });

  it("passes when panels is an array", () => {
    expect(validate({ id: "x", name: "x", version: "1", panels: [] })).toBe(true);
  });

  it("passes when verseActions is an array", () => {
    expect(
      validate({ id: "x", name: "x", version: "1", verseActions: [] }),
    ).toBe(true);
  });

  it("returns true on a fully valid plugin", () => {
    expect(validate(makePlugin())).toBe(true);
  });
});

// ── register ──────────────────────────────────────────────────────────────────
describe("register()", () => {
  it("returns true and stores the plugin in the registry", () => {
    const p = makePlugin();
    const result = register(p);

    expect(result).toBe(true);
    expect(registry.has("test-plugin")).toBe(true);
  });

  it("syncs the plugin into window.CODEX_PLUGINS", () => {
    const p = makePlugin();
    register(p);

    expect(gw().CODEX_PLUGINS).toContain(p);
  });

  it("does not push the same object twice even if called twice on different ids", () => {
    const a = makePlugin("a");
    const b = makePlugin("b");
    register(a);
    register(b);

    expect(gw().CODEX_PLUGINS.length).toBe(2);
  });

  it("returns false and warns on invalid plugin", () => {
    const result = register(null);
    expect(result).toBe(false);
  });

  it("returns false and warns on missing id", () => {
    const result = register({ name: "x", version: "1" });
    expect(result).toBe(false);
  });

  it("returns false on duplicate id and does not re-register", () => {
    register(makePlugin("dupe"));
    const second = register(makePlugin("dupe"));

    expect(second).toBe(false);
    expect(registry.size).toBe(1);
  });

  it("does not push a duplicate into the public array", () => {
    const p = makePlugin();
    // Pre-populate the array (simulates a pre-push that register() already processed)
    gw().CODEX_PLUGINS.push(p);
    register(p); // should skip the push since it's already there

    // Still 1 entry (not 2)
    expect(gw().CODEX_PLUGINS.filter((x) => x === p).length).toBe(1);
  });
});

// ── codex:plugin-registered event ────────────────────────────────────────────
describe("register() — event", () => {
  it("fires codex:plugin-registered with { plugin } in detail", () => {
    const events: CustomEvent[] = [];
    const handler = (e: Event): void => { events.push(e as CustomEvent); };
    window.addEventListener("codex:plugin-registered", handler);

    const p = makePlugin("event-test");
    register(p);

    window.removeEventListener("codex:plugin-registered", handler);

    expect(events).toHaveLength(1);
    expect((events[0] as CustomEvent).detail).toEqual({ plugin: p });
  });

  it("does NOT fire the event for a duplicate registration", () => {
    const events: CustomEvent[] = [];
    const handler = (e: Event): void => { events.push(e as CustomEvent); };
    window.addEventListener("codex:plugin-registered", handler);

    register(makePlugin("dupe-event"));
    register(makePlugin("dupe-event")); // second: should not fire

    window.removeEventListener("codex:plugin-registered", handler);

    expect(events).toHaveLength(1);
  });
});

// ── dispatch ──────────────────────────────────────────────────────────────────
describe("dispatch()", () => {
  it("fires the named event with the given detail", () => {
    const received: unknown[] = [];
    const handler = (e: Event): void => {
      received.push((e as CustomEvent).detail);
    };
    window.addEventListener("test:event", handler);
    dispatch("test:event", { foo: "bar" });
    window.removeEventListener("test:event", handler);

    expect(received).toEqual([{ foo: "bar" }]);
  });
});

// ── list ──────────────────────────────────────────────────────────────────────
describe("list()", () => {
  it("returns an empty array when the registry is empty", () => {
    expect(list()).toEqual([]);
  });

  it("returns all registered plugins in insertion order", () => {
    const a = makePlugin("a");
    const b = makePlugin("b");
    register(a);
    register(b);

    const result = list();
    expect(result).toHaveLength(2);
    expect(result[0]).toBe(a);
    expect(result[1]).toBe(b);
  });

  it("returns a fresh array each call (not the same reference)", () => {
    register(makePlugin());
    expect(list()).not.toBe(list());
  });
});

// ── getPanels ─────────────────────────────────────────────────────────────────
describe("getPanels()", () => {
  it("returns an empty array when no plugins have panels", () => {
    register(makePlugin());
    expect(getPanels()).toEqual([]);
  });

  it("returns resolved panels from registered plugins", () => {
    register(makePluginWithPanels("p1"));
    const panels = getPanels();

    expect(panels).toHaveLength(1);
    expect(panels[0]).toMatchObject({
      pluginId: "p1",
      id: "pane-1",
      label: "Panel One",
      glyph: "✦",
    });
    expect(typeof panels[0]?.render).toBe("function");
  });

  it("falls back label to panel.id when label is absent", () => {
    register({
      id: "no-label",
      name: "No Label",
      version: "1.0.0",
      panels: [{ id: "my-pane", render: () => null }],
    });
    const panels = getPanels();
    expect(panels[0]?.label).toBe("my-pane");
  });

  // NOTE: preserved from legacy — `||` operator means empty string label also
  // falls back to the panel id.
  it("falls back label to panel.id when label is empty string (legacy || quirk)", () => {
    register({
      id: "empty-label",
      name: "Empty Label",
      version: "1.0.0",
      panels: [{ id: "my-pane", label: "", render: () => null }],
    });
    const panels = getPanels();
    expect(panels[0]?.label).toBe("my-pane");
  });

  it("falls back glyph to '◆' when glyph is absent", () => {
    register({
      id: "no-glyph",
      name: "No Glyph",
      version: "1.0.0",
      panels: [{ id: "p", render: () => null }],
    });
    expect(getPanels()[0]?.glyph).toBe("◆");
  });

  it("skips panels without a valid id", () => {
    register({
      id: "bad-panel-id",
      name: "x",
      version: "1",
      panels: [
        { id: "", render: () => null },    // empty id — invalid
        { id: "ok", render: () => null },  // valid
      ],
    });
    const panels = getPanels();
    expect(panels).toHaveLength(1);
    expect(panels[0]?.id).toBe("ok");
  });

  it("skips panels without a render function", () => {
    register({
      id: "no-render",
      name: "x",
      version: "1",
      panels: [
        { id: "pane", render: () => null },       // valid
        { id: "bad" } as unknown as { id: string; render: () => null }, // no render
      ],
    });
    expect(getPanels()).toHaveLength(1);
  });

  it("accumulates panels from multiple plugins", () => {
    register(makePluginWithPanels("p1"));
    register(makePluginWithPanels("p2"));
    expect(getPanels()).toHaveLength(2);
  });
});

// ── getVerseActions ───────────────────────────────────────────────────────────
describe("getVerseActions()", () => {
  it("returns an empty array when no plugins have verseActions", () => {
    register(makePlugin());
    expect(getVerseActions()).toEqual([]);
  });

  it("returns resolved verse actions from registered plugins", () => {
    register(makePluginWithVerseActions("va1"));
    const actions = getVerseActions();

    expect(actions).toHaveLength(1);
    expect(actions[0]).toMatchObject({
      pluginId: "va1",
      label: "Do Thing",
      icon: "▸",
    });
    expect(typeof actions[0]?.handler).toBe("function");
  });

  it("falls back icon to '◆' when icon is absent", () => {
    register({
      id: "no-icon",
      name: "x",
      version: "1",
      verseActions: [{ label: "Act", handler: () => {} }],
    });
    expect(getVerseActions()[0]?.icon).toBe("◆");
  });

  // NOTE: preserved from legacy — `||` means empty string icon also falls back.
  it("falls back icon to '◆' when icon is empty string (legacy || quirk)", () => {
    register({
      id: "empty-icon",
      name: "x",
      version: "1",
      verseActions: [{ label: "Act", icon: "", handler: () => {} }],
    });
    expect(getVerseActions()[0]?.icon).toBe("◆");
  });

  it("skips verse actions without a valid label", () => {
    register({
      id: "bad-label",
      name: "x",
      version: "1",
      verseActions: [
        { label: "", handler: () => {} },       // empty label — invalid
        { label: "Good", handler: () => {} },   // valid
      ],
    });
    expect(getVerseActions()).toHaveLength(1);
  });

  it("skips verse actions without a handler function", () => {
    register({
      id: "no-handler",
      name: "x",
      version: "1",
      verseActions: [
        { label: "Good", handler: () => {} },           // valid
        { label: "Bad" } as unknown as { label: string; handler: () => void }, // no handler
      ],
    });
    expect(getVerseActions()).toHaveLength(1);
  });

  it("accumulates actions from multiple plugins", () => {
    register(makePluginWithVerseActions("v1"));
    register(makePluginWithVerseActions("v2"));
    expect(getVerseActions()).toHaveLength(2);
  });
});

// ── onNavigate ────────────────────────────────────────────────────────────────
describe("onNavigate()", () => {
  it("calls onNavigate on every plugin that provides the hook", () => {
    const calls: [string, string][] = [];
    register({
      id: "nav-plugin",
      name: "x",
      version: "1",
      onNavigate(book: string, chapter: string): void { calls.push([book, chapter]); },
    });
    onNavigate("Genesis", "1");
    expect(calls).toEqual([["Genesis", "1"]]);
  });

  it("does not throw if a plugin's onNavigate throws (safeCall wrapper)", () => {
    register({
      id: "bad-nav",
      name: "x",
      version: "1",
      onNavigate(): void { throw new Error("boom"); },
    });
    expect(() => onNavigate("Genesis", "1")).not.toThrow();
  });

  it("skips plugins that have no onNavigate", () => {
    register(makePlugin()); // no onNavigate
    expect(() => onNavigate("Genesis", "1")).not.toThrow();
  });
});

// ── onVerseSelect ─────────────────────────────────────────────────────────────
describe("onVerseSelect()", () => {
  it("calls onVerseSelect on every plugin that provides the hook", () => {
    const refs: unknown[] = [];
    register({
      id: "vs-plugin",
      name: "x",
      version: "1",
      onVerseSelect(ref: unknown): void { refs.push(ref); },
    });
    onVerseSelect("GEN.1.1");
    expect(refs).toEqual(["GEN.1.1"]);
  });

  it("does not throw if a plugin's onVerseSelect throws (safeCall wrapper)", () => {
    register({
      id: "bad-vs",
      name: "x",
      version: "1",
      onVerseSelect(): void { throw new Error("boom"); },
    });
    expect(() => onVerseSelect("GEN.1.1")).not.toThrow();
  });
});

// ── adoptPreRegistered (boot drain) ──────────────────────────────────────────
describe("adoptPreRegistered()", () => {
  it("registers plugins that were pre-pushed into window.CODEX_PLUGINS", () => {
    const p = makePlugin("pre-boot");
    gw().CODEX_PLUGINS.push(p);

    adoptPreRegistered();

    expect(registry.has("pre-boot")).toBe(true);
  });

  it("does not register a plugin that is already in the registry", () => {
    const p = makePlugin("already");
    register(p);                     // first: adds to registry
    gw().CODEX_PLUGINS.push(p);      // simulate it being in the array too

    const sizeBefore = registry.size;
    adoptPreRegistered();
    expect(registry.size).toBe(sizeBefore);
  });

  it("is a no-op when the array is empty", () => {
    adoptPreRegistered();
    expect(registry.size).toBe(0);
  });

  it("handles plugins without id gracefully (skips them)", () => {
    gw().CODEX_PLUGINS.push({ name: "no id" });  // missing id — register() will warn
    expect(() => adoptPreRegistered()).not.toThrow();
  });
});

// ── window globals — parity probe ─────────────────────────────────────────────
describe("window globals (parity probe)", () => {
  it("typeof CODEX_PLUGINS_API === 'object'", () => {
    expect(
      typeof (window as unknown as Record<string, unknown>)["CODEX_PLUGINS_API"],
    ).toBe("object");
  });

  it("CODEX_PLUGINS is an Array", () => {
    expect(
      Array.isArray((window as unknown as Record<string, unknown>)["CODEX_PLUGINS"]),
    ).toBe(true);
  });

  it("CODEX_PLUGINS_API exposes all seven methods", () => {
    const api = gw().CODEX_PLUGINS_API;
    for (const k of [
      "register", "list", "getPanels", "getVerseActions",
      "dispatch", "onNavigate", "onVerseSelect",
    ]) {
      expect(typeof (api as unknown as Record<string, unknown>)[k]).toBe("function");
    }
  });

  it("CODEX_PLUGINS_API.register() returns true for a valid plugin", () => {
    const api = gw().CODEX_PLUGINS_API;
    const result = api.register(makePlugin("via-api"));
    expect(result).toBe(true);
    // Clean up
    registry.delete("via-api");
  });

  it("CODEX_PLUGINS_API.list() returns the same plugins as list()", () => {
    register(makePlugin("api-list-test"));
    const apiResult = gw().CODEX_PLUGINS_API.list();
    expect(apiResult).toEqual(list());
  });
});
