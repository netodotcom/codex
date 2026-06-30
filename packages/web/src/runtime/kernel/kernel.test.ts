// @vitest-environment jsdom
// kernel — faithful-port tests. Surface contract, ref parsing, tool registry,
// Strongs lookup path, and mission storage are all verified against the legacy.
import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import {
  normBook,
  parseRef,
  clip,
  register,
  call,
  TOOLS,
  loadMissions,
  saveMission,
  readTweaks,
  writeTweak,
  kernelPrompt,
  strongsEntries,
  fmtStrongs,
} from "./helpers.js";
import type { Mission } from "./types.js";

// ── localStorage shim ─────────────────────────────────────────────────────────
// jsdom's built-in localStorage is unreliable across module imports.
function installStorage(): void {
  const store: Record<string, string> = {};
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    value: {
      getItem: (k: string): string | null =>
        Object.prototype.hasOwnProperty.call(store, k) ? (store[k] as string) : null,
      setItem: (k: string, v: string): void => { store[k] = String(v); },
      removeItem: (k: string): void => { delete store[k]; },
      clear: (): void => { for (const k of Object.keys(store)) delete store[k]; },
    },
  });
}
installStorage();

// ── Stub window.CODEX_DATA so ref parsing works ───────────────────────────────
function installCodexData(): void {
  Object.defineProperty(window, "CODEX_DATA", {
    configurable: true,
    writable: true,
    value: {
      books: [
        { id: "gen", name: "Genesis" },
        { id: "john", name: "John" },
        { id: "rev", name: "Revelation" },
        { id: "1sam", name: "1 Samuel" },
      ],
      translations: [{ id: "web" }, { id: "kjv" }],
      tweaks: {},
    },
  });
}

beforeAll(async () => {
  installCodexData();
  // Import index.ts to trigger global assignment (mirrors runtime boot).
  await import("./index.js");
});

beforeEach(() => {
  // Clear missions and notes between tests
  localStorage.removeItem("codex.missions");
  localStorage.removeItem("codex.notes.v1");
  localStorage.removeItem(("codex.tweaks.v1"));
  vi.restoreAllMocks();
});

// ── normBook ──────────────────────────────────────────────────────────────────
describe("normBook()", () => {
  it("lowercases and trims", () => {
    expect(normBook("  Genesis  ")).toBe("genesis");
  });

  it("expands leading digit to roman (1 → i, 2 → ii, 3 → iii)", () => {
    expect(normBook("1 Samuel")).toBe("i samuel");
    expect(normBook("2 Kings")).toBe("ii kings");
    expect(normBook("3 John")).toBe("iii john");
  });

  it("strips dots", () => {
    expect(normBook("Rev.")).toBe("rev");
  });

  it("handles empty string gracefully", () => {
    expect(normBook("")).toBe("");
  });
});

// ── clip ──────────────────────────────────────────────────────────────────────
describe("clip()", () => {
  it("returns string unchanged when shorter than limit", () => {
    expect(clip("hello", 10)).toBe("hello");
  });

  it("truncates and appends sentinel when longer", () => {
    const result = clip("abcdef", 3);
    expect(result).toBe("abc …[truncated]");
  });

  it("handles null-ish via == null guard", () => {
    // NOTE: preserved from legacy — s == null catches both null and undefined
    expect(clip("" as unknown as string, 5)).toBe("");
  });
});

// ── parseRef ──────────────────────────────────────────────────────────────────
describe("parseRef()", () => {
  it("parses a chapter-only ref", () => {
    const r = parseRef("Genesis 1");
    expect(r).not.toBeNull();
    expect(r?.bookId).toBe("gen");
    expect(r?.bookName).toBe("Genesis");
    expect(r?.chapter).toBe(1);
    expect(r?.v1).toBeNull();
    expect(r?.v2).toBeNull();
  });

  it("parses a single-verse ref", () => {
    const r = parseRef("John 3:16");
    expect(r?.bookId).toBe("john");
    expect(r?.chapter).toBe(3);
    expect(r?.v1).toBe(16);
    expect(r?.v2).toBe(16);
  });

  it("parses a verse-range ref", () => {
    const r = parseRef("John 1:1-5");
    expect(r?.v1).toBe(1);
    expect(r?.v2).toBe(5);
  });

  it("parses a numbered-book prefix ('1 Samuel')", () => {
    const r = parseRef("1 Samuel 3");
    expect(r?.bookId).toBe("1sam");
    expect(r?.chapter).toBe(3);
  });

  it("returns null for an unparseable string", () => {
    expect(parseRef("not a ref")).toBeNull();
  });

  it("returns null when book is not found", () => {
    expect(parseRef("Nonexistent 1:1")).toBeNull();
  });

  it("prefix-matches book names", () => {
    const r = parseRef("Rev 13");
    expect(r?.bookId).toBe("rev");
  });
});

// ── Tool registry ─────────────────────────────────────────────────────────────
describe("register() / TOOLS", () => {
  it("register returns false for malformed tool", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(register(null as any)).toBe(false);
    expect(register({ name: "", run: async () => "x" })).toBe(false);
  });

  it("register returns true and adds tool to TOOLS", () => {
    const ok = register({ name: "__test_tool__", description: "test", run: async () => "ok" });
    expect(ok).toBe(true);
    expect(Object.prototype.hasOwnProperty.call(TOOLS, "__test_tool__")).toBe(true);
    delete (TOOLS as Record<string, unknown>)["__test_tool__"];
  });

  it("all built-in tools are registered", () => {
    const names = Object.keys(TOOLS);
    for (const expected of [
      "read_passage", "search_text", "cross_references", "gematria",
      "open_console", "goto", "session_trail", "strongs_lookup",
      "dictionary_lookup", "timeline_events", "save_note",
      "app_settings_get", "app_settings_set", "open_panel",
      "set_translation", "focus_mode",
    ]) {
      expect(names).toContain(expected);
    }
  });
});

// ── call() ────────────────────────────────────────────────────────────────────
describe("call()", () => {
  it("throws synchronously for unknown tool name", () => {
    expect(() => call("__does_not_exist__")).toThrow("Unknown tool: __does_not_exist__");
  });

  it("resolves with tool result for known tool", async () => {
    register({ name: "__echo__", description: "", run: async (args) => String(args["v"] ?? "") });
    const result = await call("__echo__", { v: "hello" });
    expect(result).toBe("hello");
    delete (TOOLS as Record<string, unknown>)["__echo__"];
  });
});

// ── Mission storage ───────────────────────────────────────────────────────────
describe("loadMissions() / saveMission()", () => {
  it("loadMissions returns [] when storage is empty", () => {
    expect(loadMissions()).toEqual([]);
  });

  it("saveMission persists and loadMissions reads it back", () => {
    const m: Mission = {
      id: "m_test",
      intent: "trace the logos",
      startedAt: 1000,
      status: "done",
      steps: [],
      artifact: { title: "T", summary: "S", sections: [] },
    };
    saveMission(m);
    const all = loadMissions();
    expect(all).toHaveLength(1);
    expect(all[0]?.id).toBe("m_test");
    expect(all[0]?.intent).toBe("trace the logos");
  });

  it("saveMission updates in-place when id already exists", () => {
    const m: Mission = {
      id: "m_upd",
      intent: "original",
      startedAt: 1,
      status: "running",
      steps: [],
      artifact: { title: "", summary: "", sections: [] },
    };
    saveMission(m);
    const updated = { ...m, intent: "updated", status: "done" as const };
    saveMission(updated);
    const all = loadMissions();
    expect(all).toHaveLength(1);
    expect(all[0]?.intent).toBe("updated");
    expect(all[0]?.status).toBe("done");
  });

  it("saveMission keeps ring of at most 20", () => {
    for (let i = 0; i < 25; i++) {
      saveMission({
        id: "m" + i,
        intent: "i" + i,
        startedAt: i,
        status: "done",
        steps: [],
        artifact: { title: "", summary: "", sections: [] },
      });
    }
    expect(loadMissions()).toHaveLength(20);
  });
});

// ── readTweaks / writeTweak ───────────────────────────────────────────────────
describe("readTweaks() / writeTweak()", () => {
  it("readTweaks returns {} when storage is empty", () => {
    expect(readTweaks()).toEqual({});
  });

  it("writeTweak persists a key and returns previous value", () => {
    const prev = writeTweak("fontScale", 1.2);
    expect(prev).toBeUndefined(); // first write, no previous
    const prev2 = writeTweak("fontScale", 1.4);
    expect(prev2).toBe(1.2);
    expect(readTweaks()["fontScale"]).toBe(1.4);
  });
});

// ── kernelPrompt ──────────────────────────────────────────────────────────────
describe("kernelPrompt()", () => {
  it("includes maxSteps in the RULES section", () => {
    const p = kernelPrompt(7);
    expect(p).toContain("≤ 7 total steps");
  });

  it("lists read_passage in the TOOLS block", () => {
    expect(kernelPrompt(10)).toContain("read_passage");
  });

  it("is a non-empty string", () => {
    expect(typeof kernelPrompt(10)).toBe("string");
    expect(kernelPrompt(10).length).toBeGreaterThan(100);
  });
});

// ── fmtStrongs ────────────────────────────────────────────────────────────────
describe("fmtStrongs()", () => {
  it("formats key + word + translit", () => {
    const r = fmtStrongs("H7225", { word: "רֵאשִׁית", translit: "re'shiyth", gloss: "beginning" });
    expect(r).toContain("H7225");
    expect(r).toContain("re'shiyth");
    expect(r).toContain("beginning");
  });

  it("clips long def to 400 chars", () => {
    const longDef = "x".repeat(500);
    const r = fmtStrongs("G3056", { def: longDef });
    expect(r).toContain("…[truncated]");
  });

  it("omits optional fields when absent", () => {
    const r = fmtStrongs("H1", { word: "א" });
    expect(r).toBe("H1 א — ");
  });
});

// ── strongsEntries ────────────────────────────────────────────────────────────
describe("strongsEntries()", () => {
  it("rejects when CODEX_MODULES is unavailable", async () => {
    // CODEX_MODULES is not set in this test environment
    await expect(strongsEntries("H")).rejects.toThrow(
      "Strong's lexicon unavailable (module loader missing)",
    );
  });

  it("resolves via CODEX_MODULES.loadModule when available", async () => {
    const fakeEntries = { H1: { word: "אָב", gloss: "father" } };
    Object.defineProperty(window, "CODEX_MODULES", {
      configurable: true,
      writable: true,
      value: {
        loadModule: vi.fn().mockResolvedValue({ entries: fakeEntries }),
      },
    });
    // Clear the internal module cache to force a fresh load
    // (re-import is not needed — strongsCache is cleared on rejection)
    // We must call after clearing CODEX_MODULES above
    const entries = await strongsEntries("H");
    expect(entries).toEqual(fakeEntries);
    // Clean up
    Object.defineProperty(window, "CODEX_MODULES", {
      configurable: true,
      writable: true,
      value: undefined,
    });
  });
});

// ── strongs_lookup tool via CODEX_StrongsLookup fast-path ────────────────────
describe("strongs_lookup tool (CODEX_StrongsLookup fast-path)", () => {
  it("uses window.CODEX_StrongsLookup when available", async () => {
    const fakeEntry = { word: "λόγος", translit: "logos", gloss: "word" };
    Object.defineProperty(window, "CODEX_StrongsLookup", {
      configurable: true,
      writable: true,
      value: vi.fn().mockReturnValue(fakeEntry),
    });
    const result = await call("strongs_lookup", { number: "G3056" });
    expect(result).toContain("G3056");
    expect(result).toContain("logos");
    Object.defineProperty(window, "CODEX_StrongsLookup", {
      configurable: true,
      writable: true,
      value: undefined,
    });
  });

  it("throws for a malformed Strong's number", async () => {
    await expect(call("strongs_lookup", { number: "X999" })).rejects.toThrow(
      "Bad Strong's number",
    );
  });

  it("throws when no number and no word supplied", async () => {
    await expect(call("strongs_lookup", {})).rejects.toThrow(
      "Provide a Strong's number",
    );
  });
});

// ── window.CODEX_KERNEL surface (global contract) ────────────────────────────
describe("window.CODEX_KERNEL (global contract)", () => {
  type K = {
    register: unknown;
    tools: unknown;
    toolSpecs: unknown;
    call: unknown;
    run: unknown;
    missions: unknown;
    parseRef: unknown;
  };
  const k = (): K =>
    (window as unknown as { CODEX_KERNEL: K }).CODEX_KERNEL;

  it("typeof CODEX_KERNEL === 'object'", () => {
    expect(typeof (window as unknown as Record<string, unknown>)["CODEX_KERNEL"]).toBe("object");
  });

  it("exposes all 7 methods from the legacy surface", () => {
    for (const name of [
      "register", "tools", "toolSpecs", "call", "run", "missions", "parseRef",
    ]) {
      expect(typeof (k() as Record<string, unknown>)[name]).toBe("function");
    }
  });

  it("tools() returns an array of strings", () => {
    type K2 = { tools: () => string[] };
    const result = (window as unknown as { CODEX_KERNEL: K2 }).CODEX_KERNEL.tools();
    expect(Array.isArray(result)).toBe(true);
    expect(result).toContain("read_passage");
  });

  it("toolSpecs() returns {name, description, sideEffect} objects", () => {
    type K2 = { toolSpecs: () => { name: string; description: string; sideEffect: boolean }[] };
    const specs = (window as unknown as { CODEX_KERNEL: K2 }).CODEX_KERNEL.toolSpecs();
    expect(Array.isArray(specs)).toBe(true);
    const rp = specs.find((s) => s.name === "read_passage");
    expect(rp).toBeDefined();
    expect(typeof rp?.description).toBe("string");
    expect(typeof rp?.sideEffect).toBe("boolean");
    expect(rp?.sideEffect).toBe(false);
  });

  it("toolSpecs() marks side-effect tools correctly", () => {
    type K2 = { toolSpecs: () => { name: string; sideEffect: boolean }[] };
    const specs = (window as unknown as { CODEX_KERNEL: K2 }).CODEX_KERNEL.toolSpecs();
    const oc = specs.find((s) => s.name === "open_console");
    expect(oc?.sideEffect).toBe(true);
  });

  it("parseRef() works through the global surface", () => {
    type K2 = { parseRef: (ref: string) => { bookId: string } | null };
    const r = (window as unknown as { CODEX_KERNEL: K2 }).CODEX_KERNEL.parseRef("John 3:16");
    expect(r?.bookId).toBe("john");
  });

  it("missions() returns an array", () => {
    type K2 = { missions: () => unknown[] };
    expect(Array.isArray((window as unknown as { CODEX_KERNEL: K2 }).CODEX_KERNEL.missions())).toBe(true);
  });

  it("call() throws for unknown tool", () => {
    type K2 = { call: (name: string) => Promise<string> };
    expect(() =>
      (window as unknown as { CODEX_KERNEL: K2 }).CODEX_KERNEL.call("__not_registered__"),
    ).toThrow("Unknown tool");
  });

  it("register() adds a new tool visible via tools()", () => {
    type K2 = {
      register: (t: { name: string; run: () => Promise<string> }) => boolean;
      tools: () => string[];
    };
    const kk = window as unknown as { CODEX_KERNEL: K2 };
    kk.CODEX_KERNEL.register({ name: "__surface_test__", run: async () => "ok" });
    expect(kk.CODEX_KERNEL.tools()).toContain("__surface_test__");
    delete (TOOLS as Record<string, unknown>)["__surface_test__"];
  });
});

// ── save_note tool ────────────────────────────────────────────────────────────
describe("save_note tool", () => {
  it("throws when body is empty", async () => {
    await expect(call("save_note", { ref: "", body: "" })).rejects.toThrow(
      "Note body is empty",
    );
  });

  it("persists note to localStorage and returns confirmation", async () => {
    const result = await call("save_note", {
      ref: "John 1:1",
      title: "Logos",
      body: "In the beginning was the Word.",
    });
    expect(result).toContain("Note saved");
    expect(result).toContain("John 1:1");
    const notes = JSON.parse(localStorage.getItem("codex.notes.v1") ?? "[]") as unknown[];
    expect(notes).toHaveLength(1);
  });
});

// ── app_settings_get / app_settings_set tools ─────────────────────────────────
describe("app_settings_get / app_settings_set tools", () => {
  it("set then get a key", async () => {
    await call("app_settings_set", { key: "accent", value: "violet" });
    const result = await call("app_settings_get", { key: "accent" });
    const parsed = JSON.parse(result) as { key: string; value: unknown; set: boolean };
    expect(parsed.value).toBe("violet");
    expect(parsed.set).toBe(true);
  });

  it("app_settings_set throws when key is missing", async () => {
    await expect(call("app_settings_set", { value: "x" })).rejects.toThrow("Need args.key");
  });

  it("app_settings_set throws when value is missing", async () => {
    await expect(call("app_settings_set", { key: "x" })).rejects.toThrow("Need args.value");
  });
});
