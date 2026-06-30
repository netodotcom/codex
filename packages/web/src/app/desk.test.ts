// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { deskLoad, deskPanelsLoad, BUILTIN_PANEL_IDS, DESK_KEY, DESK_PANELS_KEY } from "./desk.js";

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
});

describe("deskLoad", () => {
  it("defaults to reader-only on first open", () => {
    expect(deskLoad()).toEqual({ reader: true, library: false, oracle: false, marks: false, focus: false });
  });
  it("normalises a stored blob (reader defaults true, others coerce to bool)", () => {
    localStorage.setItem(DESK_KEY, JSON.stringify({ library: 1, oracle: true }));
    expect(deskLoad()).toEqual({ reader: true, library: true, oracle: true, marks: false, focus: false });
  });
  it("honours reader:false explicitly", () => {
    localStorage.setItem(DESK_KEY, JSON.stringify({ reader: false }));
    expect(deskLoad().reader).toBe(false);
  });
});

describe("deskPanelsLoad", () => {
  it("returns the stored builtin panel ids, filtering unknowns", () => {
    localStorage.setItem(DESK_PANELS_KEY, JSON.stringify(["gem", "talmud", "bogus"]));
    expect(deskPanelsLoad()).toEqual(["gem", "talmud"]);
  });
  it("migrates legacy pinned panels once when no desk-panels key exists", () => {
    localStorage.setItem("codex.panels.pinned.v1", JSON.stringify(["comm", "nope", "exeg"]));
    expect(deskPanelsLoad()).toEqual(["comm", "exeg"]);
  });
  it("returns empty when nothing is stored", () => {
    expect(deskPanelsLoad()).toEqual([]);
  });
});

describe("BUILTIN_PANEL_IDS", () => {
  it("lists the eight builtin panels", () => {
    expect(BUILTIN_PANEL_IDS).toEqual(["trans", "talmud", "comm", "gem", "gnosis", "disarm", "exeg", "txan"]);
  });
});
